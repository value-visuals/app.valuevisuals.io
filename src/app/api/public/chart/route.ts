import { NextRequest, NextResponse } from "next/server";
import { fetchPublicMarketApi } from "@/lib/market/publicBackend";
import { parseMarketCurrency } from "@/lib/market/publicMarketTypes";

export const runtime = "nodejs";
const symbols: Record<string, string> = {
  bitcoin: "BTC", ethereum: "ETH", monero: "XMR", gold: "XAU", silver: "XAG",
};
const allowedDays = new Set(["1", "7", "30", "90"]);
type Candle = { t?: unknown; c?: unknown };
type BackendChart = { currency?: string; candles?: Candle[]; updatedAt?: string | null; fxEstimate?: unknown };
type ChartPoint = { time: number; price: number };

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Backend candle timestamps are milliseconds; keep them unchanged for Recharts. */
function chartPoints(candles: Candle[] | undefined): ChartPoint[] {
  if (!Array.isArray(candles)) return [];
  return candles.map(candle => ({ time: number(candle?.t) ?? NaN, price: number(candle?.c) ?? NaN }))
    .filter(point => Number.isFinite(point.time) && Number.isFinite(point.price))
    .sort((a, b) => a.time - b.time);
}

async function fallbackCryptoChart(asset: string, currency: string, days: string): Promise<ChartPoint[]> {
  // Best-effort fallback only. Firebase remains the primary historical source.
  const url = `https://api.coingecko.com/api/v3/coins/${asset}/market_chart?vs_currency=${currency.toLowerCase()}&days=${days}`;
  const result = await fetch(url, { next: { revalidate: 180 }, signal: AbortSignal.timeout(6_000) });
  if (!result.ok) throw new Error("Public chart fallback unavailable");
  const payload = await result.json();
  if (!Array.isArray(payload?.prices)) return [];
  const stride = Math.max(1, Math.ceil(payload.prices.length / 220));
  return payload.prices.filter((_: unknown, index: number) => index % stride === 0 || index === payload.prices.length - 1)
    .map((item: unknown) => {
      const row = Array.isArray(item) ? item : [];
      return { time: number(row[0]) ?? NaN, price: number(row[1]) ?? NaN };
    }).filter((point: ChartPoint) => Number.isFinite(point.time) && Number.isFinite(point.price));
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const asset = (params.get("asset") ?? "bitcoin").toLowerCase();
  const days = params.get("days") ?? "7";
  const currency = parseMarketCurrency(params.get("currency"));
  const symbol = symbols[asset];
  if (!symbol || !allowedDays.has(days)) {
    return NextResponse.json({ error: "Invalid asset or chart range." }, { status: 400 });
  }

  try {
    const isMetal = symbol === "XAU" || symbol === "XAG";
    // Metals do not trade continuously: include the latest session on weekends.
    const range = isMetal && days === "1" ? "7d" : `${days}d`;
    const query = new URLSearchParams({ currency, range });
    if (isMetal) query.set("symbol", `${symbol}/${currency}`);
    else query.set("symbol", symbol);
    const endpoint = isMetal ? "/api/metals/chart" : "/api/crypto/chart";
    const result = await fetchPublicMarketApi<BackendChart>(`${endpoint}?${query}`);
    const points = chartPoints(result.candles);
    if (points.length < 2) throw new Error("No stored candle history");
    return NextResponse.json({ asset, currency, days: Number(days), points, updatedAt: result.updatedAt, ...(result.fxEstimate ? { fxEstimate: result.fxEstimate } : {}) }, {
      headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    console.warn("[public/chart] Backend chart unavailable:", asset, currency, error instanceof Error ? error.message : error);
    if (symbol !== "XAU" && symbol !== "XAG") {
      try {
        const points = await fallbackCryptoChart(asset, currency, days);
        if (points.length >= 2) return NextResponse.json({ asset, currency, days: Number(days), points, fallback: true }, {
          headers: { "Cache-Control": "public, max-age=0, s-maxage=60, stale-while-revalidate=120" },
        });
      } catch { /* Preserve a clear unavailable response below. */ }
    }
    return NextResponse.json({ error: "Historical market data is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
