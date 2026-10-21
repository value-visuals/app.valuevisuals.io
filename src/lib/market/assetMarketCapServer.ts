import type { MarketCapCurrency, MarketCapRankingResponse, RankedAsset } from "./assetMarketCapTypes";
import { trackedMarketCapAsset } from "./assetMarketCapTypes";

const SOURCE = "https://assetmarketcap.com/API/daily";
const FX_SOURCE = "https://api.frankfurter.dev/v2/rate/USD/";
// Four-hour polling keeps one container near 186 calls in a 31-day month (free limit: 1,000).
// If running multiple replicas, use a shared/persistent cache or a longer TTL.
const FRESH_MS = 4 * 60 * 60 * 1000;
const STALE_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 5 * 60 * 1000;
const FX_FRESH_MS = 12 * 60 * 60 * 1000;

type RawRow = Record<string, unknown>;
type Snapshot = { rows: Omit<RankedAsset, "marketCap" | "price">[]; asOf: string | null; fetchedAt: string; expiresAt: number };
type FxQuote = { rate: number; asOf: string | null; expiresAt: number };

let snapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;
let retryAfter = 0;
const fxCache = new Map<"EUR" | "GBP", FxQuote>();
const fxInflight = new Map<"EUR" | "GBP", Promise<FxQuote>>();
const fxRetryAfter = new Map<"EUR" | "GBP", number>();

function finite(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value !== "number" && typeof value !== "string") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function optionalDate(value: unknown): string | null {
  return typeof value === "string" && value.length < 50 && Number.isFinite(Date.parse(value)) ? value : null;
}

/** Isolated pure parser: safe to test with vendor fixtures and rejects malformed upstream data. */
export function normalizeDaily(payload: unknown, fetchedAt: string): Snapshot {
  if (!payload || typeof payload !== "object") throw new Error("Unexpected ranking response");
  const { data, metadata } = payload as { data?: unknown; metadata?: Record<string, unknown> };
  if (!Array.isArray(data) || data.length === 0) throw new Error("Ranking response is empty");
  const seen = new Set<number>();
  const rows: Snapshot["rows"] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const raw = entry as RawRow;
    const rank = finite(raw.Rank);
    const ticker = typeof raw.Ticker === "string" ? raw.Ticker.trim() : "";
    const name = typeof raw.Name === "string" ? raw.Name.trim() : "";
    const assetType = typeof raw.AssetType === "string" ? raw.AssetType.trim() : "";
    if (!rank || !Number.isInteger(rank) || rank < 1 || rank > 100 || seen.has(rank) || !ticker || !name || !assetType) continue;
    seen.add(rank);
    rows.push({
      rank, ticker: ticker.slice(0, 56), name: name.slice(0, 120), assetType: assetType.slice(0, 48),
      marketCapUsd: finite(raw.MarketCap),
      priceUsd: finite(raw.Price),
      change24hPct: finite(raw["24HrChange"]),
      circulatingSupply: finite(raw.CirculatingSupply),
      trackedAsset: trackedMarketCapAsset(name, ticker, assetType),
    });
  }
  rows.sort((a, b) => a.rank - b.rank);
  if (rows.length === 0) throw new Error("No valid assets in ranking response");
  return { rows, asOf: optionalDate(metadata?.asOf), fetchedAt, expiresAt: Date.now() + FRESH_MS };
}

async function fetchDaily(): Promise<Snapshot> {
  const key = process.env.ASSETMARKETCAP_API_KEY?.trim();
  if (!key) throw new Error("AssetMarketCap not configured");
  const response = await fetch(SOURCE, {
    method: "GET",
    headers: { Accept: "application/json", "X-API-Key": key },
    next: { revalidate: 14400 },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) {
    if (response.status === 429) {
      // Respect provider throttling instead of retrying on every visitor request.
      const retrySeconds = Number(response.headers.get("retry-after"));
      retryAfter = Date.now() + (Number.isFinite(retrySeconds) && retrySeconds > 0 ? Math.min(retrySeconds * 1000, 7 * 86400000) : 6 * 3600000);
    }
    if (response.status === 401 || response.status === 402) retryAfter = Date.now() + 3600000;
    throw new Error(`AssetMarketCap returned ${response.status}`);
  }
  const raw: unknown = await response.json();
  const data = normalizeDaily(raw, new Date().toISOString());
  retryAfter = 0;
  snapshot = data;
  return data;
}

async function getSnapshot(): Promise<{ value: Snapshot; stale: boolean }> {
  const now = Date.now();
  if (snapshot && snapshot.expiresAt > now) return { value: snapshot, stale: false };
  if (retryAfter > now) {
    if (snapshot && snapshot.expiresAt + STALE_MS > now) return { value: snapshot, stale: true };
    throw new Error("Ranking feed temporarily unavailable");
  }
  if (!inflight) {
    inflight = fetchDaily().finally(() => { inflight = null; });
  }
  try {
    return { value: await inflight, stale: false };
  } catch {
    retryAfter = Math.max(retryAfter, Date.now() + RETRY_MS);
    if (snapshot && snapshot.expiresAt + STALE_MS > Date.now()) return { value: snapshot, stale: true };
    throw new Error("Ranking feed temporarily unavailable");
  }
}

async function getFx(currency: MarketCapCurrency): Promise<{ rate: number | null; asOf: string | null }> {
  if (currency === "USD") return { rate: 1, asOf: null };
  const cached = fxCache.get(currency);
  if (cached && cached.expiresAt > Date.now()) return cached;
  if ((fxRetryAfter.get(currency) ?? 0) > Date.now()) return cached && cached.expiresAt + STALE_MS > Date.now() ? cached : { rate: null, asOf: null };
  if (!fxInflight.has(currency)) {
    const task = (async (): Promise<FxQuote> => {
      const response = await fetch(`${FX_SOURCE}${currency}`, {
        headers: { Accept: "application/json" },
        next: { revalidate: 43200 }, signal: AbortSignal.timeout(7000),
      });
      if (!response.ok) throw new Error("FX unavailable");
      const result: unknown = await response.json();
      if (!result || typeof result !== "object") throw new Error("FX malformed");
      const record = result as { rate?: unknown; date?: unknown };
      const rate = finite(record.rate);
      if (rate === null || rate <= 0) throw new Error("FX missing rate");
      const quote = { rate, asOf: optionalDate(record.date), expiresAt: Date.now() + FX_FRESH_MS };
      fxCache.set(currency, quote);
      fxRetryAfter.delete(currency);
      return quote;
    })().finally(() => { fxInflight.delete(currency); });
    fxInflight.set(currency, task);
  }
  try { return await fxInflight.get(currency)!; }
  catch {
    fxRetryAfter.set(currency, Date.now() + RETRY_MS);
    // FX failure should never imply that USD market caps are expressed in EUR/GBP.
    return cached && cached.expiresAt + STALE_MS > Date.now() ? cached : { rate: null, asOf: null };
  }
}

export async function getMarketCapRanking(currency: MarketCapCurrency, limit: 10 | 100): Promise<MarketCapRankingResponse> {
  const [{ value, stale }, fx] = await Promise.all([getSnapshot(), getFx(currency)]);
  return {
    source: "AssetMarketCap", sourceUrl: "https://assetmarketcap.com/", currency,
    asOf: value.asOf, fetchedAt: value.fetchedAt, stale,
    cacheSeconds: FRESH_MS / 1000, fxRate: fx.rate, fxAsOf: fx.asOf,
    count: value.rows.length,
    data: value.rows.slice(0, limit).map((row) => ({
      ...row,
      marketCap: row.marketCapUsd === null || fx.rate === null ? null : row.marketCapUsd * fx.rate,
      price: row.priceUsd === null || fx.rate === null ? null : row.priceUsd * fx.rate,
    })),
  };
}
