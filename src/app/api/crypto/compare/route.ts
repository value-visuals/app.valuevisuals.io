import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/getApiUrl";
import { compareCandles } from "@/lib/market/comparison";

export const runtime = "nodejs";
export const revalidate = 60;

const symbols = { bitcoin: "BTC", ethereum: "ETH", monero: "XMR" } as const;
type Coin = keyof typeof symbols;
const allowedDays = new Set(["1", "2", "3", "7", "14", "30", "60", "90", "180", "365"]);

type Candle = { t?: unknown; c?: unknown; close?: unknown };
type BackendChart = { candles?: Candle[]; updatedAt?: string };

function coin(value: string | null): Coin | null {
  const normalized = (value ?? "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(symbols, normalized) ? normalized as Coin : null;
}

/** Use the same recorded candle history as the Value Visuals charts. */
async function backendCandles(asset: Coin, days: string): Promise<BackendChart> {
  const url = new URL(`${getApiUrl()}/api/crypto/chart`);
  url.searchParams.set("symbol", symbols[asset]);
  url.searchParams.set("range", `${days}d`);
  url.searchParams.set("interval", "auto");
  url.searchParams.set("currency", "USD");
  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Backend candle request returned ${response.status}`);
  const body = await response.json() as BackendChart;
  if (!Array.isArray(body?.candles) || body.candles.length < 2) {
    throw new Error("Backend candle history unavailable");
  }
  return body;
}

/** Preserve the existing CoinGecko path when public backend candles are unavailable. */
async function coinGeckoCandles(asset: Coin, days: string): Promise<Candle[]> {
  const url = `https://api.coingecko.com/api/v3/coins/${asset}/market_chart?vs_currency=usd&days=${days}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`CoinGecko request returned ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body?.prices)) throw new Error("No CoinGecko price history");
  return body.prices.map((price: unknown) => {
    const row = Array.isArray(price) ? price : [];
    return { t: row[0], c: row[1] };
  });
}

export async function GET(request: NextRequest) {
  const params = new URL(request.url).searchParams;
  const base = coin(params.get("base"));
  const quote = coin(params.get("quote"));
  const days = params.get("days") ?? "30";
  if (!base || !quote || !allowedDays.has(days) || base === quote) {
    return NextResponse.json({ error: "Invalid comparison assets or range" }, { status: 400 });
  }

  try {
    const [baseData, quoteData] = await Promise.all([
      backendCandles(base, days), backendCandles(quote, days),
    ]);
    const prices = compareCandles(baseData.candles, quoteData.candles, Number(days));
    if (prices.length < 2) throw new Error("Stored series could not be aligned");
    return NextResponse.json({
      base, quote, pair: `${base}/${quote}`, days: Number(days), prices,
      current: prices[prices.length - 1].price,
      updatedAt: baseData.updatedAt ?? quoteData.updatedAt ?? new Date().toISOString(),
      source: "Value Visuals API",
    });
  } catch (error) {
    console.warn("[crypto/compare] Recorded candles unavailable; trying provider fallback:", error instanceof Error ? error.message : error);
  }

  try {
    const [baseCandles, quoteCandles] = await Promise.all([
      coinGeckoCandles(base, days), coinGeckoCandles(quote, days),
    ]);
    const prices = compareCandles(baseCandles, quoteCandles, Number(days));
    if (prices.length < 2) throw new Error("Fallback series could not be aligned");
    return NextResponse.json({
      base, quote, pair: `${base}/${quote}`, days: Number(days), prices,
      current: prices[prices.length - 1].price,
      updatedAt: new Date().toISOString(), source: "CoinGecko fallback",
    });
  } catch (error) {
    console.error("[crypto/compare] No comparison history available:", error);
    return NextResponse.json({ error: "Market comparison is temporarily unavailable", prices: [] }, { status: 503 });
  }
}
