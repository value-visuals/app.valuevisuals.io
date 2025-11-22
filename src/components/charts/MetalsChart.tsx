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

type ChartPoint = { t: number; price: number };

// include cookies like your tile/crypto charts
const fetcher = (url: string) =>
  fetch(url, { cache: "no-store", credentials: "include" }).then((r) => r.json());

const METAL_META: Record<
  "gold" | "silver" | "platinum" | "palladium",
  { name: string; color: string; symbol: "XAU" | "XAG" | "XPT" | "XPD" }
> = {
  gold: { name: "Gold (XAU)", color: "#FFD700", symbol: "XAU" }, // bright yellow gold
  silver: { name: "Silver (XAG)", color: "#C0C0C0", symbol: "XAG" }, // lighter silver
  platinum: { name: "Platinum (XPT)", color: "#E5E4E2", symbol: "XPT" }, // more metallic platinum
  palladium: { name: "Palladium (XPD)", color: "#B0C4DE", symbol: "XPD" }, // soft steel blue
};

// Match PriceChart ranges/buttons
const RANGES = [
  { label: "1D", value: "1d", days: 1 },
  { label: "2D", value: "2d", days: 2 },
  { label: "3D", value: "3d", days: 3 },
  { label: "1W", value: "7d", days: 7 },
  { label: "2W", value: "14d", days: 14 },
  { label: "1M", value: "30d", days: 30 },
  { label: "2M", value: "60d", days: 60 },
  { label: "3M", value: "90d", days: 90 },
  { label: "6M", value: "180d", days: 180 },
  { label: "1Y", value: "365d", days: 365 },
];

// Accept { points: [{t,o,h,l,c}] } (ISO t) OR { prices:[[t,price]] } OR { points:[{t,p}] }
function toChartData(payload: any): ChartPoint[] {
  const arr = Array.isArray(payload?.points)
    ? payload.points
    : Array.isArray(payload?.prices)
    ? payload.prices
    : [];

  if (!Array.isArray(arr)) return [];

  const out = arr
    .map((row: any) => {
      // tuple form: [t, price]
      if (Array.isArray(row)) {
        const [t, v] = row;
        const ts = Number.isFinite(+t) ? +t : Date.parse(String(t)); // accept ISO
        const price = Number(v);
        return Number.isFinite(ts) && Number.isFinite(price) ? { t: ts, price } : null;
      }
      // object form
      if (row && typeof row === "object") {
        const tRaw = row.t ?? row.time ?? row[0];
        const ts =
          typeof tRaw === "string" ? Date.parse(tRaw) : Number.isFinite(+tRaw) ? +tRaw : NaN;

        // prefer p/price/value; fallback to close (c)
        const pRaw = row.p ?? row.price ?? row.value ?? row.c ?? row[1];
        const price = Number(pRaw);

        return Number.isFinite(ts) && Number.isFinite(price) ? { t: ts, price } : null;
      }
      return null;
    })
    .filter(Boolean) as ChartPoint[];

  return out;
}

function formatXAxis(ts: number, totalDays: number) {
  const d = new Date(ts);
  if (totalDays <= 3) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Compact price: $950, $10k, $10.5k, $110k
function formatPrice(n: number) {
  const v = Number(n);
  if (Number.isNaN(v)) return "";
  if (v >= 1000) {
    const use0dp = v >= 100_000;
    const k = v / 1000;
    const s = use0dp ? k.toFixed(0) : k.toFixed(1).replace(/\.0$/, "");
    return `$${s}k`;
  }
  return `$${Math.round(v).toLocaleString()}`;
}

export default function MetalsChart({
  metal = "gold",
  className = "",
}: {
  metal?: "gold" | "silver" | "platinum" | "palladium";
  className?: string;
}) {
  const meta = METAL_META[metal];
  const [range, setRange] = React.useState<string>("3d");
  const selected = RANGES.find((r) => r.value === range) ?? RANGES[0];

  // Next.js proxy translates to backend params
  const url = `/api/metals/chart?metal=${metal}&range=${encodeURIComponent(range)}&days=${selected.days}`;
  const { data, isLoading } = useSWR<any>(url, fetcher, { refreshInterval: 60_000 });

  const rawPoints: ChartPoint[] = toChartData(data);
  const chartData = rawPoints.map((p) => ({
    t: p.t,
    label: formatXAxis(p.t, selected.days),
    price: p.price,
  }));

  return (
    <div className={`rounded-2xl bg-card text-card-foreground p-4 shadow-sm ring-1 ring-border ${className}`}>
      {/* Title */}
      <div className="flex items-center gap-2 mb-2">
        <h3 className="text-lg font-semibold text-muted-foreground">{meta.name}</h3>
      </div>

      {/* Range buttons (identical structure/classes to PriceChart) */}
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
                      ? // Active: white bg, black text in dark mode
                        "bg-white text-foreground shadow-sm border border-border dark:text-black"
                      : // Inactive
                        "bg-transparent text-muted-foreground hover:bg-muted/70",
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
              tickMargin={8}   
            />
            <YAxis
              domain={["auto", "auto"]}
              tickFormatter={(v) => formatPrice(Number(v))}
              orientation="right"
              width={64}
              tick={{ fill: "var(--muted-foreground)" }}
              axisLine={false}
              tickLine={false}
              tickMargin={8} 
            />
            <Tooltip
              formatter={(v: number) => formatPrice(v)}
              labelFormatter={(_label: any, payloadArg: unknown) => {
                const payload = payloadArg as ReadonlyArray<any>;
                const ts = payload?.[0]?.payload?.t as number | undefined;
                if (!ts) return "";
                const d = new Date(ts);
                return selected.days <= 3
                  ? d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
                  : d.toLocaleString(undefined, { month: "short", day: "numeric" });
              }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                color: "var(--popover-foreground)",
                borderRadius: "0.75rem",
              }}
              labelStyle={{ color: "var(--popover-foreground)" }}
            />

            {/* Gradient under the line */}
            <defs>
              <linearGradient id={`metalGradient-${metal}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={meta.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={meta.color} stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <Area
              type="monotone"
              dataKey="price"
              stroke="none"
              fillOpacity={1}
              fill={`url(#metalGradient-${metal})`}
              isAnimationActive={!isLoading}
            />
            <Line
              type="monotone"
              dataKey="price"
              dot={false}
              activeDot={{ r: 4 }}
              stroke={meta.color}
              strokeWidth={2}
              isAnimationActive={!isLoading}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
