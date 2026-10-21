"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { clientApiUrl } from "@/lib/clientApiUrl";
import { filterChartPointsByWindow, parseChartTimestamp } from "@/lib/market/chartWindow";
import type { MarketQuoteCurrency, MarketAssetId } from "@/lib/market/publicMarketTypes";

type Point = { time: number; price: number };
const ranges = [
  { label: "24H", days: "1" },
  { label: "7D", days: "7" },
  { label: "30D", days: "30" },
  { label: "90D", days: "90" },
] as const;

export type ChartRangeDays = (typeof ranges)[number]["days"];
export type ChartPerformance = { asset: MarketAssetId; currency: MarketQuoteCurrency; days: ChartRangeDays; change: number | null };

/** Existing metal history routes have multiple possible candle shapes. */
function normalizePoints(payload: unknown, metal: boolean, range: string): Point[] {
  const result = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const raw = [result.points, result.prices, result.candles].find(Array.isArray);
  if (!Array.isArray(raw)) return [];
  const values = raw.map((row: unknown): Point | null => {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const timeRaw = Array.isArray(row) ? row[0] : item.time ?? item.t ?? item.timestamp ?? item.datetime;
    const priceRaw = Array.isArray(row) ? (metal ? row[4] ?? row[1] : row[1]) : item.price ?? item.p ?? item.c ?? item.close ?? item.value;
    const time = parseChartTimestamp(timeRaw);
    const price = Number(priceRaw);
    return Number.isFinite(time) && time > 0 && Number.isFinite(price) && price > 0 ? { time, price } : null;
  }).filter((item: Point | null): item is Point => item !== null).sort((a: Point, b: Point) => a.time - b.time);
  const distinct = values.filter((p: Point, i: number) => i === 0 || p.time !== values[i - 1].time);
  if (!metal) return distinct;
  return filterChartPointsByWindow(distinct.map(p => ({ t: p.time, price: p.price })), `${range}d`)
    .map(p => ({ time: p.t, price: p.price }));
}

export default function MarketPriceChart({ asset, currency, days, onRangeChange, onPerformanceChange }: {
  asset: MarketAssetId;
  currency: MarketQuoteCurrency;
  days: ChartRangeDays;
  onRangeChange: (days: ChartRangeDays) => void;
  onPerformanceChange: (value: ChartPerformance) => void;
}) {
  const [points, setPoints] = useState<Point[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const isMetal = asset === "gold" || asset === "silver";

  useEffect(() => {
    const controller = new AbortController();
    setPoints([]);
    setError("");
    setBusy(true);
    const url = `/api/public/chart?asset=${asset}&currency=${currency}&days=${days}`;
    const request = fetch(clientApiUrl(url), { signal: controller.signal, cache: "no-store" });
    request.then(async response => {
      if (!response.ok) throw new Error("Price history is temporarily unavailable.");
      return response.json();
    }).then(payload => {
      if (controller.signal.aborted) return;
      const history = normalizePoints(payload, isMetal, days);
      setPoints(history);
      const firstPrice = history[0]?.price;
      const lastPrice = history[history.length - 1]?.price;
      onPerformanceChange({
        asset, currency, days,
        change: history.length >= 2 && firstPrice != null && firstPrice > 0 && lastPrice != null && Number.isFinite(lastPrice)
          ? ((lastPrice / firstPrice) - 1) * 100
          : null,
      });
    }).catch(() => {
      if (controller.signal.aborted) return;
      setError("Chart feed temporarily unavailable.");
      onPerformanceChange({ asset, currency, days, change: null });
    }).finally(() => {
      if (!controller.signal.aborted) setBusy(false);
    });
    return () => controller.abort();
  }, [asset, currency, days, isMetal, onPerformanceChange]);

  const first = points[0]?.price ?? 0;
  const last = points[points.length - 1]?.price ?? 0;
  const up = last >= first;
  const gradient = "vv-detail-chart-gradient";
  const chartPoints = useMemo(() => points.filter(point => Number.isFinite(point.time) && Number.isFinite(point.price)), [points]);
  const formatPrice = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency", currency, maximumFractionDigits: value >= 100 ? 0 : value >= 1 ? 2 : 5,
  }).format(value);

  return <div className="vv-chart-wrapper">
    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div><p className="text-xs text-muted-foreground">Price performance</p>
        <p className="text-sm font-semibold">{`${ranges.find(r => r.days === days)?.label} price history`}</p></div>
      <div className="vv-range-controls" aria-label="Chart range">{ranges.map(range =>
        <button type="button" key={range.days} aria-pressed={days === range.days} onClick={() => onRangeChange(range.days)} className={days === range.days ? "active" : ""}>{range.label}</button>,
      )}</div>
    </div>
    <div className="h-[240px] sm:h-[275px] w-full min-w-0">
      {busy ? <div className="vv-chart-empty animate-pulse" role="status">Loading historical prices…</div>
        : error || chartPoints.length < 2 ? <div role="status" className="vv-chart-empty">{error || "No real historical prices available for this range."}</div>
        : <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartPoints} margin={{ top: 8, right: 2, left: -21, bottom: 0 }}>
            <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={up ? "#667a90" : "#ea747b"} stopOpacity={0.24}/><stop offset="100%" stopColor={up ? "#667a90" : "#ea747b"} stopOpacity={0}/></linearGradient></defs>
            <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 6" vertical={false}/>
            <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]}
              tickFormatter={value => days === "1" ? new Date(Number(value)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : new Date(Number(value)).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} minTickGap={28}/>
            <YAxis domain={["auto", "auto"]} tickFormatter={value => Number(value) >= 1_000 ? `${(Number(value) / 1_000).toFixed(0)}k` : Number(value).toFixed(0)}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false}/>
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--foreground)", fontSize: 12 }}
              labelFormatter={value => new Date(Number(value)).toLocaleString()} formatter={value => [formatPrice(Number(value)), "Price"]}/>
            <Area type="monotone" dataKey="price" stroke={up ? "#667a90" : "#ea747b"} strokeWidth={2.5} fill={`url(#${gradient})`} dot={false} isAnimationActive={false}/>
          </AreaChart>
        </ResponsiveContainer>}
    </div>
  </div>;
}
