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

type ChartPoint = {
  t: number;
  price: number;
};

const fetcher = (url: string) =>
  fetch(url, {
    cache: "no-store",
    credentials: "include",
  }).then((r) => r.json());

const METAL_META: Record<
  "gold" | "silver" | "platinum" | "palladium",
  {
    name: string;
    color: string;
    symbol: "XAU" | "XAG" | "XPT" | "XPD";
  }
> = {
  gold: {
    name: "Gold",
    color: "#FFD700",
    symbol: "XAU",
  },

  silver: {
    name: "Silver",
    color: "#C0C0C0",
    symbol: "XAG",
  },

  platinum: {
    name: "Platinum",
    color: "#E5E4E2",
    symbol: "XPT",
  },

  palladium: {
    name: "Palladium",
    color: "#B0C4DE",
    symbol: "XPD",
  },
};

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

function toChartData(payload: any): ChartPoint[] {
  const arr = Array.isArray(payload?.points)
    ? payload.points
    : Array.isArray(payload?.prices)
      ? payload.prices
      : [];

  if (!Array.isArray(arr)) return [];

  const out = arr
    .map((row: any) => {
      // Tuple: [timestamp, price]
      if (Array.isArray(row)) {
        const [t, v] = row;

        const ts = Number.isFinite(+t)
          ? +t
          : Date.parse(String(t));

        const price = Number(v);

        return Number.isFinite(ts) &&
          Number.isFinite(price)
          ? { t: ts, price }
          : null;
      }

      // Object format
      if (row && typeof row === "object") {
        const tRaw =
          row.t ??
          row.time ??
          row.timestamp ??
          row[0];

        const ts =
          typeof tRaw === "string"
            ? Date.parse(tRaw)
            : Number.isFinite(+tRaw)
              ? +tRaw
              : NaN;

        const pRaw =
          row.p ??
          row.price ??
          row.value ??
          row.c ??
          row.close ??
          row[1];

        const price = Number(pRaw);

        return Number.isFinite(ts) &&
          Number.isFinite(price)
          ? { t: ts, price }
          : null;
      }

      return null;
    })
    .filter(Boolean) as ChartPoint[];

  return out.sort((a, b) => a.t - b.t);
}

function formatXAxis(
  ts: number,
  totalDays: number
) {
  const d = new Date(ts);

  if (totalDays <= 3) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatPrice(n: number) {
  const v = Number(n);

  if (!Number.isFinite(v)) return "";

  if (v >= 1000) {
    const use0dp = v >= 100_000;
    const k = v / 1000;

    const s = use0dp
      ? k.toFixed(0)
      : k.toFixed(1).replace(/\.0$/, "");

    return `$${s}k`;
  }

  return `$${Math.round(v).toLocaleString()}`;
}

function formatFullPrice(n: number) {
  const v = Number(n);

  if (!Number.isFinite(v)) return "";

  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return "0.00%";

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getChange(data: ChartPoint[]) {
  if (data.length < 2) {
    return {
      change: 0,
      percent: 0,
    };
  }

  const first = data[0].price;
  const last = data[data.length - 1].price;

  if (
    !Number.isFinite(first) ||
    !Number.isFinite(last) ||
    first === 0
  ) {
    return {
      change: 0,
      percent: 0,
    };
  }

  const change = last - first;
  const percent = (change / first) * 100;

  return {
    change,
    percent,
  };
}

function MetalTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: number;
}) {
  if (!active || !payload?.length) return null;

  const price = Number(payload[0]?.value);

  if (!Number.isFinite(price)) return null;

  const date = new Date(Number(label));

  return (
    <div
      className="
        min-w-[150px]
        rounded-xl
        border
        border-border
        bg-popover/95
        px-3
        py-2.5
        shadow-xl
        backdrop-blur-md
      "
    >
      <div className="mb-1 text-[11px] font-medium text-muted-foreground">
        {date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}
      </div>

      <div className="text-base font-semibold tracking-tight text-popover-foreground">
        {formatFullPrice(price)}
      </div>
    </div>
  );
}

export default function MetalsChart({
  metal = "gold",
  className = "",
}: {
  metal?: "gold" | "silver" | "platinum" | "palladium";
  className?: string;
}) {
  const meta = METAL_META[metal];

  const [range, setRange] =
    React.useState<string>("3d");

  const selected =
    RANGES.find((r) => r.value === range) ??
    RANGES[0];

  const [hoveredPrice, setHoveredPrice] =
    React.useState<number | null>(null);

  const url = `/api/metals/chart?metal=${metal}&range=${encodeURIComponent(
    range
  )}&days=${selected.days}`;

  const { data, isLoading } = useSWR<any>(
    url,
    fetcher,
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
    }
  );

  const rawPoints = toChartData(data);

  const chartData = rawPoints.map((p) => ({
    t: p.t,
    label: formatXAxis(
      p.t,
      selected.days
    ),
    price: p.price,
  }));

  const latestPrice =
    chartData.length > 0
      ? chartData[chartData.length - 1].price
      : null;

  const { change, percent } =
    getChange(chartData);

  const isPositive = percent >= 0;

  const gradientId =
    `metalGradient-${metal}`;

  return (
    <div
      className={`
        group
        relative
        overflow-hidden
        rounded-2xl
        bg-card
        text-card-foreground
        p-5
        shadow-sm
        ring-1
        ring-border
        transition-shadow
        duration-200
        hover:shadow-md
        ${className}
      `}
    >
      {/* Subtle metal-color accent */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{
          background: `linear-gradient(
            90deg,
            transparent,
            ${meta.color},
            transparent
          )`,
        }}
      />

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            {/* Metal color indicator */}
            <div
              className="
                flex
                size-8
                shrink-0
                items-center
                justify-center
                rounded-full
                bg-muted/60
                ring-1
                ring-border/60
              "
            >
              <span
                className="size-3 rounded-full"
                style={{
                  backgroundColor: meta.color,
                  boxShadow:
                    `0 0 10px ${meta.color}55`,
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold tracking-tight">
                {meta.name}
              </h3>

              <span className="text-xs font-medium text-muted-foreground">
                {meta.symbol}
              </span>
            </div>
          </div>

          {/* Current price */}
          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-2xl font-bold tracking-tight sm:text-3xl">
              {latestPrice !== null
                ? formatFullPrice(latestPrice)
                : "—"}
            </span>

            {chartData.length > 1 && (
              <span
                className={
                  isPositive
                    ? "text-sm font-semibold text-emerald-500"
                    : "text-sm font-semibold text-red-500"
                }
              >
                {formatPercent(percent)}
              </span>
            )}
          </div>

          {chartData.length > 1 && (
            <div className="mt-1 text-xs text-muted-foreground">
              {change >= 0 ? "+" : ""}
              {formatFullPrice(change)} over{" "}
              {selected.label}
            </div>
          )}
        </div>

        {/* Live indicator */}
        <div
          className="
            flex
            shrink-0
            items-center
            gap-1.5
            rounded-full
            border
            border-border/60
            bg-muted/40
            px-2.5
            py-1
            text-[10px]
            font-medium
            uppercase
            tracking-wider
            text-muted-foreground
          "
        >
          <span className="relative flex size-1.5">
            <span
              className="
                absolute
                inline-flex
                size-full
                animate-ping
                rounded-full
                opacity-60
              "
              style={{
                backgroundColor: meta.color,
              }}
            />

            <span
              className="
                relative
                inline-flex
                size-1.5
                rounded-full
              "
              style={{
                backgroundColor: meta.color,
              }}
            />
          </span>

          Live
        </div>
      </div>

      {/* Range buttons */}
      <div className="mt-5 flex items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label={`${meta.name} chart range`}
          className="
            flex
            max-w-full
            overflow-x-auto
            rounded-lg
            border
            border-border
            bg-muted/60
            p-1
            shadow-sm
            backdrop-blur
            supports-[backdrop-filter]:bg-muted/50
            no-scrollbar
          "
        >
          {RANGES.map((r) => {
            const active = r.value === range;

            return (
              <button
                key={r.value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setRange(r.value);
                  setHoveredPrice(null);
                }}
                className={[
                  "h-7 sm:h-8",
                  "shrink-0",
                  "rounded-md",
                  "px-2.5 sm:px-3",
                  "text-[11px] sm:text-xs",
                  "font-semibold",
                  "transition-all duration-150",
                  "select-none",
                  "focus:outline-none",
                  "focus-visible:ring-2",
                  "focus-visible:ring-ring",
                  "focus-visible:ring-offset-2",
                  active
                    ? "bg-white text-foreground shadow-sm border border-border dark:text-black"
                    : "bg-transparent text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                ].join(" ")}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
          {selected.label}
        </div>
      </div>

      {/* Chart */}
      <div
        className="
          relative
          -mx-5
          mt-3
          h-[290px]
          w-[calc(100%+2.5rem)]
          sm:mx-0
          sm:h-[300px]
          sm:w-full
        "
      >
        {isLoading && chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span
                className="
                  size-3
                  animate-spin
                  rounded-full
                  border-2
                  border-muted-foreground/30
                  border-t-muted-foreground
                "
              />

              Loading chart…
            </div>
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No chart data available.
          </div>
        ) : (
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <ComposedChart
              data={chartData}
              margin={{
                top: 10,
                right: 4,
                bottom: 4,
                left: 4,
              }}
              onMouseMove={(state: any) => {
                const price =
                  state?.activePayload?.[0]?.value;

                if (typeof price === "number") {
                  setHoveredPrice(price);
                }
              }}
              onMouseLeave={() => {
                setHoveredPrice(null);
              }}
            >
              {/* Original metal-colored gradient */}
              <defs>
                <linearGradient
                  id={gradientId}
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor={meta.color}
                    stopOpacity={0.4}
                  />

                  <stop
                    offset="100%"
                    stopColor={meta.color}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>

              {/* Original grid treatment */}
              <CartesianGrid
                stroke="var(--border)"
                strokeDasharray="3 3"
              />

              <XAxis
                dataKey="label"
                minTickGap={35}
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
                axisLine={false}
                tickLine={false}
                tickMargin={10}
              />

              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={(v) =>
                  formatPrice(Number(v))
                }
                orientation="right"
                width={68}
                tick={{
                  fill: "var(--muted-foreground)",
                  fontSize: 10,
                }}
                axisLine={false}
                tickLine={false}
                tickMargin={8}
              />

              <Tooltip
                cursor={{
                  stroke: meta.color,
                  strokeWidth: 1,
                  strokeDasharray: "4 4",
                  strokeOpacity: 0.55,
                }}
                content={
                  <MetalTooltip />
                }
                formatter={(v: number) =>
                  formatFullPrice(v)
                }
                labelFormatter={(
                  _label: any,
                  payloadArg: unknown
                ) => {
                  const payload =
                    payloadArg as ReadonlyArray<any>;

                  const ts =
                    payload?.[0]?.payload?.t as
                      | number
                      | undefined;

                  if (!ts) return "";

                  const d = new Date(ts);

                  return selected.days <= 3
                    ? d.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })
                    : d.toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        year:
                          selected.days >= 30
                            ? "numeric"
                            : undefined,
                      });
                }}
                contentStyle={{
                  background: "var(--popover)",
                  border:
                    "1px solid var(--border)",
                  color:
                    "var(--popover-foreground)",
                  borderRadius: "0.75rem",
                  boxShadow:
                    "0 8px 24px rgba(0, 0, 0, 0.12)",
                }}
                labelStyle={{
                  color:
                    "var(--muted-foreground)",
                  marginBottom: "4px",
                  fontSize: "11px",
                }}
                itemStyle={{
                  color: meta.color,
                  fontWeight: 600,
                }}
              />

              {/* Gradient */}
              <Area
                type="monotone"
                dataKey="price"
                stroke="none"
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                isAnimationActive={!isLoading}
                animationDuration={500}
              />

              {/* Price line */}
              <Line
                type="monotone"
                dataKey="price"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: meta.color,
                  stroke: "var(--background)",
                  strokeWidth: 2,
                }}
                stroke={meta.color}
                strokeWidth={2.25}
                isAnimationActive={!isLoading}
                animationDuration={500}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-3">
        <div className="text-[11px] text-muted-foreground">
          {chartData.length > 0
            ? `${chartData.length.toLocaleString()} data points`
            : "No data"}
        </div>

        <div className="text-[11px] text-muted-foreground">
          Updated automatically
        </div>
      </div>
    </div>
  );
}