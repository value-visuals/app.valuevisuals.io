import { NextRequest, NextResponse } from "next/server";
import { fetchPublicMarketApi } from "@/lib/market/publicBackend";
import { parseMarketCurrency, type MarketQuoteCurrency } from "@/lib/market/publicMarketTypes";

export const runtime = "nodejs";
const allowedDays = new Set(["1", "7", "30"]);
const FRESH_MS = 60_000;
const STALE_MS = 15 * 60_000;
type BackendCap = {
  currency?: string;
  points?: { t?: unknown; marketCap?: unknown }[];
  updatedAt?: string | null;
  fxEstimate?: unknown;
};
type CapResult = {
  currency: MarketQuoteCurrency;
  days: number;
  points: { time: number; value: number }[];
  updatedAt: string | null;
  fxEstimate?: unknown;
  stale?: boolean;
  source?: "Value Visuals API" | "CoinGecko fallback";
};
const cache = new Map<string, { data: CapResult; stored: number }>();
const inflight = new Map<string, Promise<CapResult>>();

async function loadFromBackend(currency: MarketQuoteCurrency, days: string): Promise<CapResult> {
  const query = new URLSearchParams({ currency, range: `${days}d` });
  const body = await fetchPublicMarketApi<BackendCap>(`/api/market/cap/chart?${query}`);
  if (body.currency?.toUpperCase() !== currency || !Array.isArray(body.points)) {
    throw new Error("Unexpected market-cap response");
  }
  const points = body.points.map(row => ({ time: Number(row.t), value: Number(row.marketCap) }))
    .filter(point => Number.isFinite(point.time) && point.time > 0 && Number.isFinite(point.value) && point.value > 0)
    .sort((a, b) => a.time - b.time);
  if (points.length < 2) throw new Error("Market-cap history unavailable");
  return {
    currency, days: Number(days), points, updatedAt: body.updatedAt ?? null, source: "Value Visuals API",
    ...(body.fxEstimate ? { fxEstimate: body.fxEstimate } : {}),
  };
}

const coins = ["bitcoin", "ethereum", "monero"] as const;
type Point = { time: number; value: number };

async function loadFromCoinGecko(currency: MarketQuoteCurrency, days: string): Promise<CapResult> {
  // Preserve the original public fallback when recorded Firebase cap history is incomplete.
  const series = await Promise.all(coins.map(async coin => {
    const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=${currency.toLowerCase()}&days=${days}`;
    const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(7_000), next: { revalidate: 300 } });
    if (!response.ok) throw new Error(`Market-cap fallback returned ${response.status}`);
    const json = await response.json();
    if (!Array.isArray(json?.market_caps)) throw new Error("No market-cap history from fallback");
    return (json.market_caps as unknown[]).map((raw): Point | null => {
      const row = Array.isArray(raw) ? raw : [];
      const time = Number(row[0]); const value = Number(row[1]);
      return Number.isFinite(time) && time > 0 && Number.isFinite(value) && value > 0 ? { time, value } : null;
    }).filter((point): point is Point => point !== null).sort((a, b) => a.time - b.time);
  }));
  if (series.some(points => points.length < 2)) throw new Error("Incomplete market-cap fallback history");

  const base = series[0];
  const interval = (base.at(-1)!.time - base[0].time) / Math.max(1, base.length - 1);
  const tolerance = Math.min(10_800_000, Math.max(90_000, interval * 0.6));
  const nearest = (points: Point[], time: number): number | null => {
    let low = 0; let high = points.length - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if (points[mid].time < time) low = mid + 1; else high = mid - 1;
    }
    const candidates = [points[low], points[high]].filter((point): point is Point => !!point);
    candidates.sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time));
    return candidates[0] && Math.abs(candidates[0].time - time) <= tolerance ? candidates[0].value : null;
  };
  const combined = base.map(point => {
    const eth = nearest(series[1], point.time);
    const xmr = nearest(series[2], point.time);
    return eth !== null && xmr !== null ? { time: point.time, value: point.value + eth + xmr } : null;
  }).filter((point): point is Point => point !== null);
  if (combined.length < 2) throw new Error("Cannot align historical market caps");
  const stride = Math.max(1, Math.ceil(combined.length / 180));
  return {
    currency, days: Number(days), source: "CoinGecko fallback", updatedAt: new Date().toISOString(),
    points: combined.filter((_, i) => i % stride === 0 || i === combined.length - 1),
  };
}

async function load(currency: MarketQuoteCurrency, days: string): Promise<CapResult> {
  try {
    return await loadFromBackend(currency, days);
  } catch (error) {
    console.warn("[public/tracked-cap] Firebase history unavailable; trying historical fallback:", error instanceof Error ? error.message : error);
    return loadFromCoinGecko(currency, days);
  }
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const days = params.get("days") ?? "7";
  if (!allowedDays.has(days)) return NextResponse.json({ error: "Invalid range" }, { status: 400 });
  const currency = parseMarketCurrency(params.get("currency"));
  const key = `${currency}:${days}`;
  const old = cache.get(key);
  if (old && Date.now() - old.stored < FRESH_MS) return NextResponse.json(old.data);
  let pending = inflight.get(key);
  if (!pending) {
    pending = load(currency, days).finally(() => inflight.delete(key));
    inflight.set(key, pending);
  }
  try {
    const data = await pending;
    cache.set(key, { data, stored: Date.now() });
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" } });
  } catch (error) {
    console.warn("[public/tracked-cap] Backend history unavailable:", currency, days, error instanceof Error ? error.message : error);
    if (old && Date.now() - old.stored < STALE_MS) {
      return NextResponse.json({ ...old.data, stale: true }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Tracked market-cap history is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
