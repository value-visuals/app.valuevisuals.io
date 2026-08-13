"use client";

import React from "react";
import useSWR from "swr";
import Image from "next/image";
import { useCurrency } from "@/components/Currency";

import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

type ChartPoint = {
  t: number;
  price: number;
};

const COIN_META: Record<
  "bitcoin" | "ethereum" | "monero",
  {
    name: string;
    color: string;
    logo: string;
    symbol: "BTC" | "ETH" | "XMR";
  }
> = {
  bitcoin: {
    name: "Bitcoin",
    color: "#F7931A",
    logo: "/bitcoin.svg",
    symbol: "BTC",
  },

  ethereum: {
    name: "Ethereum",
    color: "#627EEA",
    logo: "/ethereum.png",
    symbol: "ETH",
  },

  monero: {
    name: "Monero",
    color: "#FF6600",
    logo: "/monero.svg",
    symbol: "XMR",
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
  if (Array.isArray(payload?.prices)) {
    return payload.prices.map((p: [number, number]) => ({
      t: Number(p[0]),
      price: Number(p[1]),
    }));
  }

  const c = payload?.candles;

  if (Array.isArray(c) && c.length > 0) {
    if (typeof c[0] === "object" && !Array.isArray(c[0])) {
      return c.map((k: any) => ({
        t: Number(k.time ?? k.t ?? k.timestamp ?? k[0]),
        price: Number(
          k.close ?? k.c ?? k[4] ?? k.price ?? k.o ?? 0
        ),
      }));
    }

    return c.map((k: any[]) => ({
      t: Number(k[0]),
      price: Number(k[4] ?? k[1] ?? 0),
    }));
  }

  return [];
}

function formatMoney(n: number, currency: string) {
  const v = Number(n);

  if (!Number.isFinite(v)) return "";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v);
}

function formatFullMoney(n: number, currency: string) {
  const v = Number(n);

  if (!Number.isFinite(v)) return "";

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatXAxis(ts: number, totalDays: number) {
  const d = new Date(ts);

  if (totalDays <= 3) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (totalDays <= 14) {
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  }

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
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

  if (!Number.isFinite(first) || !Number.isFinite(last) || first === 0) {
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

function ChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: any[];
  label?: number;
  currency: string;
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
        border-border/70
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
        {formatFullMoney(price, currency)}
      </div>
    </div>
  );
}

export default function PriceChart({
  coin,
  className = "",
}: {
  coin: "bitcoin" | "ethereum" | "monero";
  className?: string;
}) {
  const meta = COIN_META[coin];

  const [range, setRange] = React.useState<string>("3d");

  const selected =
    RANGES.find((r) => r.value === range) ?? RANGES[0];

  const { currency } = useCurrency();

  const [hoveredPrice, setHoveredPrice] =
    React.useState<number | null>(null);

  const url = `/api/crypto/chart?symbol=${meta.symbol}&range=${encodeURIComponent(
    range
  )}&interval=auto&currency=${currency}&coin=${coin}&days=${selected.days}`;

  const { data, isLoading } = useSWR<any>(
    url,
    (u) => fetch(u).then((r) => r.json()),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
    }
  );

  const rawPoints = toChartData(data);

  const chartData = rawPoints
    .filter(
      (p) =>
        Number.isFinite(p.t) &&
        Number.isFinite(p.price)
    )
    .sort((a, b) => a.t - b.t);

  const latestPrice =
    chartData.length > 0
      ? chartData[chartData.length - 1].price
      : null;

  const { change, percent } = getChange(chartData);

  const isPositive = percent >= 0;

  const chartColor = meta.color;

  const gradientId = `price-gradient-${coin}`;

  return (
    <div
      className={`
        group
        relative
        overflow-hidden
        rounded-2xl
        border
        border-border/70
        bg-card
        text-card-foreground
        shadow-sm
        transition-shadow
        duration-200
        hover:shadow-md
        ${className}
      `}
    >
      {/* Very subtle top accent */}
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{
          background: `linear-gradient(
            90deg,
            transparent,
            ${chartColor},
            transparent
          )`,
        }}
      />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {/* Coin identity */}
            <div className="flex items-center gap-2.5">
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
                <Image
                  src={meta.logo}
                  alt={meta.name}
                  width={20}
                  height={20}
                  className="size-5 object-contain"
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

            {/* Price */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold tracking-tight sm:text-3xl">
                {latestPrice !== null
                  ? formatFullMoney(latestPrice, currency)
                  : "—"}
              </span>

              {chartData.length > 1 && (
                <span
                  className={`
                    text-sm
                    font-semibold
                    ${
                      isPositive
                        ? "text-emerald-500"
                        : "text-red-500"
                    }
                  `}
                >
                  {formatPercent(percent)}
                </span>
              )}
            </div>

            {chartData.length > 1 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {isPositive ? "+" : ""}
                {formatFullMoney(change, currency)} over {selected.label}
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
                className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                style={{ backgroundColor: chartColor }}
              />
              <span
                className="relative inline-flex size-1.5 rounded-full"
                style={{ backgroundColor: chartColor }}
              />
            </span>

            Live
          </div>
        </div>

        {/* Timeframe toolbar */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <div
            role="tablist"
            aria-label={`${meta.name} chart range`}
            className="
              flex
              max-w-full
              overflow-x-auto
              rounded-lg
              bg-muted/50
              p-1
              scrollbar-none
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
                  className={`
                    h-7
                    shrink-0
                    rounded-md
                    px-2.5
                    text-[11px]
                    font-semibold
                    transition-all
                    duration-150
                    focus:outline-none
                    focus-visible:ring-2
                    focus-visible:ring-ring
                    ${
                      active
                        ? "bg-background text-foreground shadow-sm ring-1 ring-border/60"
                        : "text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    }
                  `}
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
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{
                  top: 10,
                  right: 4,
                  bottom: 4,
                  left: 4,
                }}
              >
                {/* Original coin-colored gradient */}
                <defs>
                  <linearGradient
                    id={`colorGradient-${coin}`}
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

                {/* Original grid */}
                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />

                <XAxis
                  type="number"
                  dataKey="t"
                  domain={["dataMin", "dataMax"]}
                  scale="time"
                  tickFormatter={(value) =>
                    formatXAxis(Number(value), selected.days)
                  }
                  minTickGap={24}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                />

                <YAxis
                  domain={["auto", "auto"]}
                  tickFormatter={(v) =>
                    formatMoney(Number(v), currency)
                  }
                  orientation="right"
                  width={58}
                  tick={{
                    fill: "var(--muted-foreground)",
                    fontSize: 11,
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
                  formatter={(v: number) =>
                    formatMoney(v, currency)
                  }
                  labelFormatter={(_, payloadArg: unknown) => {
                    const payload = payloadArg as ReadonlyArray<any>;

                    const ts = payload?.[0]?.payload?.t as
                      | number
                      | undefined;

                    if (!ts) return "";

                    const d = new Date(ts);

                    return selected.days <= 3
                      ? d.toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
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
                    border: "1px solid var(--border)",
                    color: "var(--popover-foreground)",
                    borderRadius: "0.75rem",
                    boxShadow:
                      "0 8px 24px rgba(0, 0, 0, 0.12)",
                  }}
                  labelStyle={{
                    color: "var(--muted-foreground)",
                  }}
                  itemStyle={{
                    color: meta.color,
                    fontWeight: 600,
                  }}
                />

                {/* Original gradient area */}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="none"
                  fillOpacity={1}
                  fill={`url(#colorGradient-${coin})`}
                  isAnimationActive={!isLoading}
                  animationDuration={500}
                />

                {/* Slightly more polished price line */}
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

        {/* Bottom status */}
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
    </div>
  );
}