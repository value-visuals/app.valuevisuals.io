/** Public data belongs to public sources, never to an authenticated user session. */
import { NextRequest, NextResponse } from "next/server";
import { fetchPublicMarketApi } from "@/lib/market/publicBackend";
import { ASSETS, parseMarketCurrency, type MarketAsset, type MarketAssetId, type MarketQuoteCurrency, type PublicMarkets } from "@/lib/market/publicMarketTypes";

export const runtime = "nodejs";
const FRESH_MS = 60_000;
const STALE_MS = 15 * 60_000;
const cached = new Map<MarketQuoteCurrency, { expires: number; saved: number; data: PublicMarkets }>();
const inflight = new Map<MarketQuoteCurrency, Promise<PublicMarkets>>();

function finite(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function json(url: string, ms = 8_000): Promise<any> {
  // Fixed provider origins only. Never build a user-controlled remote URL.
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(ms), next: { revalidate: 60 } });
  if (!response.ok) throw new Error(`Upstream status ${response.status}`);
  return response.json();
}

function quoteFromCmc(item: any, currency: MarketQuoteCurrency): any {
  if (Array.isArray(item)) return quoteFromCmc(item[0], currency);
  return item?.quote?.[currency] ?? item?.quote?.[currency.toLowerCase()] ?? null;
}

async function getCmcQuotes(currency: MarketQuoteCurrency): Promise<Record<string, any>> {
  try {
    const response = await json(`https://pro-api.coinmarketcap.com/public-api/v3/cryptocurrency/quotes/latest?symbol=BTC,ETH,XMR&convert=${currency}`);
    if (response?.status?.error_code && Number(response.status.error_code) !== 0) return {};
    if (!response?.data || typeof response.data !== "object") return {};
    // V3 may key records by numeric CMC ID rather than the requested symbol.
    const bySymbol: Record<string, any> = {};
    for (const [key, raw] of Object.entries(response.data as Record<string, any>)) {
      const records = Array.isArray(raw) ? raw : [raw];
      for (const record of records) {
        const symbol = String(record?.symbol ?? key).toUpperCase();
        if (["BTC", "ETH", "XMR"].includes(symbol)) bySymbol[symbol] = record;
      }
    }
    return bySymbol;
  } catch { return {}; }
}

async function loadProviderFallback(currency: MarketQuoteCurrency): Promise<PublicMarkets> {
  const [cg, fx, gold, silver, sentiment] = await Promise.allSettled([
    json(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=${currency.toLowerCase()}&ids=bitcoin,ethereum,monero&order=market_cap_desc&per_page=3&page=1&sparkline=true&price_change_percentage=7d`),
    currency === "USD" ? Promise.resolve({ rate: 1 }) : json(`https://api.frankfurter.dev/v2/rate/usd/${currency.toLowerCase()}`),
    json("https://api.gold-api.com/price/XAU"),
    json("https://api.gold-api.com/price/XAG"),
    json("https://api.alternative.me/fng/?limit=1"),
  ]);

  const rows: any[] = cg.status === "fulfilled" && Array.isArray(cg.value) ? cg.value : [];
  const cgById = new Map(rows.map((row) => [row?.id, row]));
  // Query CMC only when the primary source is missing the core fields.
  const needsCmc = ["bitcoin", "ethereum", "monero"].some(id => {
    const r = cgById.get(id);
    return !r || finite(r.current_price) === null || finite(r.market_cap) === null || finite(r.total_volume) === null || finite(r.price_change_percentage_24h) === null;
  });
  const cmc = needsCmc ? await getCmcQuotes(currency) : {};
  const fxRate = currency === "USD" ? 1 : fx.status === "fulfilled" ? finite(fx.value?.rate) : null;

  const assets: MarketAsset[] = ASSETS.map(base => {
    if (base.category === "Crypto") {
      const cgCoin = cgById.get(base.id);
      const q = quoteFromCmc(cmc[base.symbol], currency);
      const sparkline: number[] = Array.isArray(cgCoin?.sparkline_in_7d?.price)
        ? cgCoin.sparkline_in_7d.price.filter((value: unknown) => finite(value) !== null).map(Number).filter((value: number) => value > 0)
        : [];
      return {
        ...base,
        price: finite(cgCoin?.current_price) ?? finite(q?.price),
        change24h: finite(cgCoin?.price_change_percentage_24h) ?? finite(q?.percent_change_24h),
        change7d: finite(cgCoin?.price_change_percentage_7d_in_currency) ?? finite(q?.percent_change_7d),
        marketCap: finite(cgCoin?.market_cap) ?? finite(q?.market_cap),
        volume24h: finite(cgCoin?.total_volume) ?? finite(q?.volume_24h),
        sparkline,
        source: cgCoin?.current_price != null ? "CoinGecko" : (q ? "CoinMarketCap" : "Unavailable"),
      };
    }
    const result = base.id === "gold" ? gold : silver;
    const quote = result.status === "fulfilled" ? result.value : null;
    const priceUsd = finite(quote?.price);
    const price = priceUsd != null && fxRate != null ? priceUsd * fxRate : null;
    const previous = finite(quote?.prev_close_price) ?? finite(quote?.previous_close);
    const change = previous != null && previous > 0 && priceUsd != null ? (priceUsd - previous) / previous * 100 : null;
    return {
      ...base,
      price, change24h: change, change7d: null, marketCap: null,
      volume24h: null, sparkline: [],
      source: price == null ? "Unavailable" : currency === "USD" ? "Gold API · USD/oz" : "Gold API · converted from USD/oz",
    };
  });

  let sentimentValue: number | null = null;
  let sentimentLabel = "";
  if (sentiment.status === "fulfilled") {
    const d = sentiment.value?.data;
    const obj = Array.isArray(d) ? d[0] : d;
    sentimentValue = finite(obj?.value);
    sentimentLabel = String(obj?.value_classification ?? obj?.value_classification_text ?? obj?.name ?? "Market sentiment");
  }

  if (!assets.some(asset => asset.price !== null)) throw new Error("No market feeds available");
  return {
    currency,
    updatedAt: new Date().toISOString(),
    assets,
    sentiment: sentimentValue !== null && sentimentValue >= 0 && sentimentValue <= 100 ? { value: sentimentValue, label: sentimentLabel } : null,
  };
}

type BackendMarketRow = {
  symbol?: string;
  source?: string;
  price?: unknown;
  change24hPct?: unknown;
  change7dPct?: unknown;
  marketCap?: unknown;
  volume24h?: unknown;
};
type BackendOverview = { currency?: string; updatedAt?: string | null; assets?: BackendMarketRow[] };

async function loadFromBackend(currency: MarketQuoteCurrency): Promise<PublicMarkets> {
  // The Node API reads the same Firebase candles used by authenticated Analysis.
  // Its /api/market/overview route is PUBLIC and does not require an ID token.
  const backend = await fetchPublicMarketApi<BackendOverview>(`/api/market/overview?currency=${currency}`);
  if (!Array.isArray(backend?.assets) || backend.currency?.toUpperCase() !== currency) {
    throw new Error("Unexpected backend overview response");
  }
  const bySymbol = new Map(backend.assets.map(row => [String(row.symbol ?? "").toUpperCase(), row]));
  const assets: MarketAsset[] = ASSETS.map(base => {
    const row = bySymbol.get(base.symbol);
    return {
      ...base,
      price: finite(row?.price),
      change24h: finite(row?.change24hPct),
      change7d: finite(row?.change7dPct),
      marketCap: base.category === "Crypto" ? finite(row?.marketCap) : null,
      volume24h: base.category === "Crypto" ? finite(row?.volume24h) : null,
      sparkline: [], // Loaded independently from public candle history, so prices render first.
      source: row?.source === "marketData" ? "Value Visuals API" : (row?.source || "Unavailable"),
    };
  });
  if (!assets.some(asset => asset.price !== null)) {
    throw new Error("Backend overview has no available prices");
  }

  let sentiment: PublicMarkets["sentiment"] = null;
  try {
    // Optional context: a sentiment-provider outage must not hide five live quotes.
    const result = await json("https://api.alternative.me/fng/?limit=1", 1_200);
    const entry = Array.isArray(result?.data) ? result.data[0] : result?.data;
    const value = finite(entry?.value);
    if (value !== null && value >= 0 && value <= 100) {
      sentiment = { value, label: String(entry?.value_classification || "Market sentiment") };
    }
  } catch { /* Sentiment is independent of prices. */ }

  return { currency, assets, sentiment, updatedAt: backend.updatedAt || new Date().toISOString() };
}

async function load(currency: MarketQuoteCurrency): Promise<PublicMarkets> {
  try {
    return await loadFromBackend(currency);
  } catch (error) {
    console.warn("[public/markets] Firebase-backed overview unavailable; using public provider fallback:", error instanceof Error ? error.message : error);
    return loadProviderFallback(currency);
  }
}

export async function GET(request: NextRequest) {
  const currency = parseMarketCurrency(new URL(request.url).searchParams.get("currency"));
  const previous = cached.get(currency);
  if (previous && previous.expires > Date.now()) {
    return NextResponse.json(previous.data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" } });
  }
  let work = inflight.get(currency);
  if (!work) {
    work = load(currency).finally(() => { inflight.delete(currency); });
    inflight.set(currency, work);
  }
  try {
    const data = await work;
    cached.set(currency, { data, saved: Date.now(), expires: Date.now() + FRESH_MS });
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" } });
  } catch {
    if (previous && Date.now() - previous.saved < STALE_MS) {
      return NextResponse.json({ ...previous.data, stale: true }, { headers: { "Cache-Control": "no-cache" } });
    }
    return NextResponse.json({ error: "Live data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
