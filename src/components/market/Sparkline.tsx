"use client";

import useSWR from "swr";
import { clientApiUrl } from "@/lib/clientApiUrl";
import type { MarketAssetId, MarketQuoteCurrency } from "@/lib/market/publicMarketTypes";

type ChartResponse = {
  asset: MarketAssetId;
  currency: MarketQuoteCurrency;
  points: { time: number; price: number }[];
};

async function getChart(path: string): Promise<ChartResponse> {
  const response = await fetch(clientApiUrl(path));
  if (!response.ok) throw new Error("Chart unavailable");
  return response.json();
}

/** Load real sparkline candles independently so the market table never waits on charts. */
export default function Sparkline({
  values, positive, width = 112, height = 35, asset, currency,
}: {
  values: number[];
  positive: boolean;
  width?: number;
  height?: number;
  asset?: MarketAssetId;
  currency?: MarketQuoteCurrency;
}) {
  const key = asset && currency && values.length === 0
    ? `/api/public/chart?asset=${asset}&currency=${currency}&days=7`
    : null;
  const { data } = useSWR<ChartResponse>(key, getChart, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const history = data?.asset === asset && data.currency === currency
    ? data.points.map(point => point.price).filter(value => Number.isFinite(value) && value > 0)
    : [];
  const readings = values.length ? values : history;
  if (readings.length < 2) return <span className="text-xs text-muted-foreground">—</span>;
  const stride = Math.max(1, Math.ceil(readings.length / 55));
  const sampled = readings.filter((_, index) => index % stride === 0 || index === readings.length - 1);
  const min = Math.min(...sampled); const max = Math.max(...sampled); const spread = max - min || 1;
  const path = sampled.map((value, index) => `${index === 0 ? "M" : "L"}${(index / Math.max(sampled.length - 1, 1) * (width - 4) + 2).toFixed(1)} ${(height - 3 - (value - min) / spread * (height - 6)).toFixed(1)}`).join(" ");
  return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={positive ? "Upward seven-day trend" : "Downward seven-day trend"}><path d={path} stroke={positive ? "#667a90" : "#ed6c71"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>;
}
