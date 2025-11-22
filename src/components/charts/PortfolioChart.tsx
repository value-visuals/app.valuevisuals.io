// components/charts/PortfolioChart.tsx
"use client";

import React from "react";
import useSWR from "swr";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type ChartPoint = { t: number | string; flow: string | number; cum: string | number };
type ChartResponse = { range: string; points: ChartPoint[]; note?: string };

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Keep ranges aligned with your backend's accepted values (30d | 90d | 1y)
const RANGES = [
  { label: "30D", value: "30d", days: 30 },
  { label: "90D", value: "90d", days: 90 },
  { label: "1Y",  value: "1y",  days: 365 },
  { label: "3Y",  value: "3y",  days: 365 * 3 },
  { label: "5Y",  value: "5y",  days: 365 * 5 },
  { label: "10Y", value: "10y", days: 365 * 10 },
];


function toNumber(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function satsToBTC(n: unknown): number {
  return toNumber(n) / 1e8;
}

function formatBTC(n: number, compact = false) {
  if (!Number.isFinite(n)) return "";
  if (compact) {
    // e.g., 0.1234 BTC, 12.3 BTC, 1.2k BTC
    const abs = Math.abs(n);
    let s: string;
    if (abs >= 1000) s = `${(abs / 1000).toFixed(1).replace(/\.0$/, "")}k`;
    else if (abs >= 10) s = abs.toFixed(1).replace(/\.0$/, "");
    else s = abs.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
    return `${n < 0 ? "-" : ""}${s} BTC`;
  }
  // Tooltip precision
  return `${n.toFixed(8)} BTC`;
}

function formatXAxis(ts: number | string, totalDays: number) {
  const ms = typeof ts === "string" ? Number(ts) * 1000 : toNumber(ts) * 1000;
  const d = new Date(ms);

  // <= ~3 months: "MMM d" (e.g., Feb 14)
  if (totalDays <= 90) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  // ~3–18 months: "MMM" (e.g., Feb)
  if (totalDays <= 365 * 1.5) {
    return d.toLocaleDateString(undefined, { month: "short" });
  }
  // ~1.5–3 years: "MMM yyyy" (e.g., Feb 2024)
  if (totalDays <= 365 * 3) {
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  }
  // >3 years: "yyyy" (e.g., 2022)
  return d.toLocaleDateString(undefined, { year: "numeric" });
}


export default function PortfolioChart({ className = "" }: { className?: string }) {
  const [range, setRange] = React.useState<string>("30d");
  const selected = RANGES.find((r) => r.value === range) ?? RANGES[0];

  // Uses the same portfolio chart endpoint your page is already calling
  // for BitcoinView (view=chart + range).  :contentReference[oaicite:2]{index=2}
  const url = `/api/crypto/portfolio/bitcoin?view=chart&range=${encodeURIComponent(range)}`;
  const { data, isLoading } = useSWR<ChartResponse>(url, fetcher, { refreshInterval: 60_000 });

  const points = Array.isArray(data?.points) ? data!.points : [];
  const chartData = points.map((p) => ({
    t: toNumber(p.t) * 1000, // ms for Recharts tooltip formatting
    label: formatXAxis(p.t, selected.days),
    cumBTC: satsToBTC(p.cum),
  }));

  const COLOR = "#F7931A"; // BTC orange

  return (
    <div className={`rounded-2xl bg-card text-card-foreground shadow-sm ${className}`}>
      {/* Title */}
      <div className="flex items-center gap-2 mb-3">
        <div className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOR }} />
        <h3 className="text-lg font-semibold text-muted-foreground">Portfolio Balance (BTC)</h3>
      </div>

      {/* Range buttons */}
      <div className="w-full mb-3">
        <div className="overflow-x-auto no-scrollbar w-full overscroll-x-contain">
          <div
            role="tablist"
            aria-label="Select chart range"
            className="inline-flex gap-0.5 p-1 rounded-lg border border-border 
                       bg-muted/60 shadow-sm backdrop-blur 
                       supports-[backdrop-filter]:bg-muted/50"
          >
            {RANGES.map((r) => {
              const active = r.value === range;
              return (
                <button
                  key={r.value}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRange(r.value)}
                  className={[
                    "h-8 sm:h-9 px-3 sm:px-4 text-xs sm:text-sm font-medium rounded-md",
                    "transition-colors duration-150 select-none",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    active
                      ? "bg-white text-foreground shadow-sm border border-border dark:text-black"
                      : "bg-transparent text-muted-foreground hover:bg-muted/70",
                  ].join(" ")}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />

            <XAxis
              dataKey="label"
              minTickGap={24}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickMargin={10}
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v) => formatBTC(Number(v), true)}
              orientation="right"
              width={88}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickMargin={8}
            />

            <Tooltip
                formatter={(v: number) => formatBTC(v)}
                labelFormatter={(_, payloadArg: unknown) => {
                    const payload = payloadArg as ReadonlyArray<any>;
                    const ts = payload?.[0]?.payload?.t as number | undefined; // ms
                    if (!ts) return "";
                    const d = new Date(ts);

                    // Match the same thresholds used in formatXAxis, but give more detail in short ranges
                    if (selected.days <= 90) {
                    return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
                    }
                    if (selected.days <= 365 * 1.5) {
                    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
                    }
                    if (selected.days <= 365 * 3) {
                    return d.toLocaleString(undefined, { month: "short", year: "numeric" });
                    }
                    return d.toLocaleString(undefined, { year: "numeric" });
                }}
                contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    color: "var(--popover-foreground)",
                    borderRadius: "0.75rem",
                }}
                labelStyle={{ color: "var(--popover-foreground)" }}
            />


            <defs>
              <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLOR} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLOR} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <Area
              type="monotone"
              dataKey="cumBTC"
              stroke="none"
              fillOpacity={1}
              fill="url(#portfolioGradient)"
              isAnimationActive={!isLoading}
            />
            <Line
              type="monotone"
              dataKey="cumBTC"
              dot={false}
              activeDot={{ r: 4 }}
              stroke={COLOR}
              strokeWidth={2}
              isAnimationActive={!isLoading}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
