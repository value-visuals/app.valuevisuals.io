"use client";

import React from "react";
import useSWR from "swr";
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
} from "recharts";

type Metal = "gold" | "silver" | "platinum" | "palladium";

type ChartPoint = {
  t: number;
  price: number;
};

const METAL_META: Record<
  Metal,
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

/* -------------------------------------------------------------------------- */
/* Data helpers                                                               */
/* -------------------------------------------------------------------------- */

function parseTimestamp(value: unknown): number {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  const n = Number(value);

  if (!Number.isFinite(n)) {
    return NaN;
  }

  // Unix seconds vs Unix milliseconds.
  if (Math.abs(n) < 100_000_000_000) {
    return n * 1000;
  }

  return n;
}

/**
 * Accept:
 *
 * { points: [{ t, c }] }
 * { points: [{ t, p }] }
 * { prices: [[t, price]] }
 * { candles: [...] }
 */
function toChartData(payload: any): ChartPoint[] {
  const source = Array.isArray(payload?.points)
    ? payload.points
    : Array.isArray(payload?.prices)
    ? payload.prices
    : Array.isArray(payload?.candles)
    ? payload.candles
    : [];

  if (!Array.isArray(source)) {
    return [];
  }

  const out = source
    .map((row: any) => {
      /* Tuple form */
      if (Array.isArray(row)) {
        const t = parseTimestamp(row[0]);
        const price = Number(row[1] ?? row[4]);

        if (
          !Number.isFinite(t) ||
          !Number.isFinite(price)
        ) {
          return null;
        }

        return {
          t,
          price,
        };
      }

      /* Object form */
      if (row && typeof row === "object") {
        const t = parseTimestamp(
          row.t ??
            row.time ??
            row.timestamp ??
            row.datetime ??
            row[0]
        );

        const price = Number(
          row.p ??
            row.price ??
            row.value ??
            row.c ??
            row.close ??
            row[1]
        );

        if (
          !Number.isFinite(t) ||
          !Number.isFinite(price)
        ) {
          return null;
        }

        return {
          t,
          price,
        };
      }

      return null;
    })
    .filter(Boolean) as ChartPoint[];

  out.sort((a, b) => a.t - b.t);

  return out;
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                 */
/* -------------------------------------------------------------------------- */

function formatMoney(
  n: number,
  currency: string
) {
  const v = Number(n);

  if (!Number.isFinite(v)) {
    return "";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(v);
}

function formatFullMoney(
  n: number,
  currency: string
) {
  const v = Number(n);

  if (!Number.isFinite(v)) {
    return "";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);
}

function formatXAxis(
  ts: number,
  totalDays: number
) {
  const d = new Date(ts);

  if (!Number.isFinite(d.getTime())) {
    return "";
  }

  if (totalDays <= 1) {
    return d.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (totalDays <= 3) {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }

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

/* -------------------------------------------------------------------------- */
/* X-axis tick generation                                                     */
/* -------------------------------------------------------------------------- */

function generateLocalTimeTicks(
  min: number,
  max: number,
  hours: number
): number[] {
  const ticks: number[] = [];

  const start = new Date(min);

  start.setMinutes(0, 0, 0);

  const remainder = start.getHours() % hours;

  if (remainder !== 0) {
    start.setHours(
      start.getHours() + (hours - remainder)
    );
  }

  let cursor = start.getTime();

  while (cursor <= max) {
    if (cursor >= min) {
      ticks.push(cursor);
    }

    const nextDate = new Date(cursor);
    nextDate.setHours(
      nextDate.getHours() + hours
    );

    const next = nextDate.getTime();

    if (next <= cursor) {
      break;
    }

    cursor = next;
  }

  return ticks;
}

function generateLocalDayTicks(
  min: number,
  max: number,
  everyDays: number
): number[] {
  const ticks: number[] = [];

  const start = new Date(min);

  start.setHours(0, 0, 0, 0);

  while (start.getTime() < min) {
    start.setDate(
      start.getDate() + everyDays
    );
  }

  let cursor = start.getTime();

  while (cursor <= max) {
    if (cursor >= min) {
      ticks.push(cursor);
    }

    const nextDate = new Date(cursor);

    nextDate.setDate(
      nextDate.getDate() + everyDays
    );

    const next = nextDate.getTime();

    if (next <= cursor) {
      break;
    }

    cursor = next;
  }

  return ticks;
}

function generateLocalMonthTicks(
  min: number,
  max: number
): number[] {
  const ticks: number[] = [];

  const start = new Date(min);

  start.setDate(1);
  start.setHours(0, 0, 0, 0);

  if (start.getTime() < min) {
    start.setMonth(
      start.getMonth() + 1
    );
  }

  let cursor = start.getTime();

  while (cursor <= max) {
    if (cursor >= min) {
      ticks.push(cursor);
    }

    const nextDate = new Date(cursor);

    nextDate.setMonth(
      nextDate.getMonth() + 1
    );

    const next = nextDate.getTime();

    if (next <= cursor) {
      break;
    }

    cursor = next;
  }

  return ticks;
}

function getXAxisTicks(
  points: ChartPoint[],
  totalDays: number
): number[] {
  if (!points.length) {
    return [];
  }

  const min = points[0].t;
  const max = points[points.length - 1].t;

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min >= max
  ) {
    return [min];
  }

  // 1D: every 4 hours.
  if (totalDays <= 1) {
    return generateLocalTimeTicks(
      min,
      max,
      4
    );
  }

  // 2D / 3D: every 6 hours.
  if (totalDays <= 3) {
    return generateLocalTimeTicks(
      min,
      max,
      6
    );
  }

  // 1W / 2W: every 2 days.
  if (totalDays <= 14) {
    return generateLocalDayTicks(
      min,
      max,
      2
    );
  }

  // 1M / 2M / 3M: every week.
  if (totalDays <= 90) {
    return generateLocalDayTicks(
      min,
      max,
      7
    );
  }

  // 6M: every 2 weeks.
  if (totalDays <= 180) {
    return generateLocalDayTicks(
      min,
      max,
      14
    );
  }

  // 1Y: monthly.
  return generateLocalMonthTicks(
    min,
    max
  );
}

/* -------------------------------------------------------------------------- */
/* Tooltip                                                                     */
/* -------------------------------------------------------------------------- */

function ChartTooltip({
  active,
  payload,
  label,
  currency,
  totalDays,
}: {
  active?: boolean;
  payload?: any[];
  label?: number;
  currency: string;
  totalDays: number;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const price = Number(
    payload[0]?.value
  );

  if (!Number.isFinite(price)) {
    return null;
  }

  const date = new Date(
    Number(label)
  );

  return (
    <div
      className="
        min-w-[165px]
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
      <div
        className="
          mb-1
          text-[11px]
          font-medium
          text-muted-foreground
        "
      >
        {date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour:
            totalDays <= 3
              ? "numeric"
              : undefined,
          minute:
            totalDays <= 3
              ? "2-digit"
              : undefined,
        })}
      </div>

      <div
        className="
          text-base
          font-semibold
          tracking-tight
          text-popover-foreground
        "
      >
        {formatFullMoney(
          price,
          currency
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function MetalsChart({
  metal,
  className = "",
}: {
  metal: Metal;
  className?: string;
}) {
  const meta = METAL_META[metal];

  const [range, setRange] =
    React.useState<string>("3d");

  const selected =
    RANGES.find(
      (r) => r.value === range
    ) ?? RANGES[0];

  const { currency } =
    useCurrency();

  /*
   * Backend supports:
   * USD / EUR / GBP
   */
  const normalizedCurrency =
    ["USD", "EUR", "GBP"].includes(
      String(currency).toUpperCase()
    )
      ? String(currency).toUpperCase()
      : "USD";

  const url =
    `/api/metals/chart` +
    `?metal=${encodeURIComponent(metal)}` +
    `&symbol=${encodeURIComponent(
      `${meta.symbol}/${normalizedCurrency}`
    )}` +
    `&range=${encodeURIComponent(range)}` +
    `&days=${selected.days}` +
    `&currency=${encodeURIComponent(
      normalizedCurrency
    )}`;

  const {
    data,
    isLoading,
    error,
  } = useSWR<any>(
    url,
    (u) =>
      fetch(u, {
        cache: "no-store",
        credentials: "include",
      }).then(async (r) => {
        if (!r.ok) {
          const body =
            await r.json().catch(
              () => null
            );

          throw new Error(
            body?.error ||
              `Request failed: ${r.status}`
          );
        }

        return r.json();
      }),
    {
      refreshInterval: 60_000,
      revalidateOnFocus: false,
    }
  );

  const chartData =
    React.useMemo(() => {
      return toChartData(data).filter(
        (p) =>
          Number.isFinite(p.t) &&
          Number.isFinite(p.price)
      );
    }, [data]);

  const latestPrice =
    chartData.length > 0
      ? chartData[
          chartData.length - 1
        ].price
      : null;

  const {
    change,
    percent,
  } = getChange(chartData);

  const isPositive =
    percent >= 0;

  const chartColor =
    meta.color;

  const gradientId =
    `metal-gradient-${metal}`;

  const xAxisTicks =
    React.useMemo(
      () =>
        getXAxisTicks(
          chartData,
          selected.days
        ),
      [chartData, selected.days]
    );

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
        className="
          absolute
          inset-x-0
          top-0
          h-px
          opacity-70
        "
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
            {/* Metal identity */}
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
                <span
                  className="
                    size-3.5
                    rounded-full
                    shadow-sm
                  "
                  style={{
                    backgroundColor:
                      chartColor,
                  }}
                />
              </div>

              <div className="flex items-center gap-2">
                <h3
                  className="
                    text-sm
                    font-semibold
                    tracking-tight
                  "
                >
                  {meta.name}
                </h3>

                <span
                  className="
                    text-xs
                    font-medium
                    text-muted-foreground
                  "
                >
                  {meta.symbol}
                </span>
              </div>
            </div>

            {/* Current price */}
            <div
              className="
                mt-3
                flex
                flex-wrap
                items-baseline
                gap-x-3
                gap-y-1
              "
            >
              <span
                className="
                  text-2xl
                  font-bold
                  tracking-tight
                  sm:text-3xl
                "
              >
                {latestPrice !== null
                  ? formatFullMoney(
                      latestPrice,
                      normalizedCurrency
                    )
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
                  {formatPercent(
                    percent
                  )}
                </span>
              )}
            </div>

            {chartData.length > 1 && (
              <div
                className="
                  mt-1
                  text-xs
                  text-muted-foreground
                "
              >
                {isPositive
                  ? "+"
                  : ""}
                {formatFullMoney(
                  change,
                  normalizedCurrency
                )}{" "}
                over{" "}
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
                  backgroundColor:
                    chartColor,
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
                  backgroundColor:
                    chartColor,
                }}
              />
            </span>

            Live
          </div>
        </div>

        {/* Timeframe toolbar */}
        <div
          className="
            mt-5
            flex
            items-center
            justify-between
            gap-3
          "
        >
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
              const active =
                r.value === range;

              return (
                <button
                  key={r.value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() =>
                    setRange(
                      r.value
                    )
                  }
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
                        ? `
                          bg-background
                          text-foreground
                          shadow-sm
                          ring-1
                          ring-border/60
                        `
                        : `
                          text-muted-foreground
                          hover:bg-background/60
                          hover:text-foreground
                        `
                    }
                  `}
                >
                  {r.label}
                </button>
              );
            })}
          </div>

          <div
            className="
              hidden
              shrink-0
              text-[11px]
              text-muted-foreground
              sm:block
            "
          >
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
          {isLoading &&
          chartData.length === 0 ? (
            <div
              className="
                flex
                h-full
                items-center
                justify-center
              "
            >
              <div
                className="
                  flex
                  items-center
                  gap-2
                  text-xs
                  text-muted-foreground
                "
              >
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
          ) : error ? (
            <div
              className="
                flex
                h-full
                items-center
                justify-center
                text-sm
                text-muted-foreground
              "
            >
              Unable to load chart data.
            </div>
          ) : chartData.length === 0 ? (
            <div
              className="
                flex
                h-full
                items-center
                justify-center
                text-sm
                text-muted-foreground
              "
            >
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
              >
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
                      stopColor={chartColor}
                      stopOpacity={0.4}
                    />

                    <stop
                      offset="100%"
                      stopColor={chartColor}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />

                {/* 
                  Real timestamp axis.

                  The points remain proportionally positioned
                  according to their actual timestamps, while
                  explicit ticks keep the labels readable.
                */}
                <XAxis
                  type="number"
                  dataKey="t"
                  domain={[
                    "dataMin",
                    "dataMax",
                  ]}
                  ticks={xAxisTicks}
                  tickFormatter={(value) =>
                    formatXAxis(
                      Number(value),
                      selected.days
                    )
                  }
                  minTickGap={
                    selected.days <= 3
                      ? 36
                      : 28
                  }
                  tick={{
                    fill:
                      "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={10}
                  padding={{
                    left: 8,
                    right: 8,
                  }}
                />

                <YAxis
                  domain={[
                    "auto",
                    "auto",
                  ]}
                  tickFormatter={(v) =>
                    formatMoney(
                      Number(v),
                      normalizedCurrency
                    )
                  }
                  orientation="right"
                  width={58}
                  tick={{
                    fill:
                      "var(--muted-foreground)",
                    fontSize: 11,
                  }}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                />

                <Tooltip
                  cursor={{
                    stroke:
                      chartColor,
                    strokeWidth: 1,
                    strokeDasharray:
                      "4 4",
                    strokeOpacity: 0.55,
                  }}
                  content={
                    <ChartTooltip
                      currency={
                        normalizedCurrency
                      }
                      totalDays={
                        selected.days
                      }
                    />
                  }
                />

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="none"
                  fillOpacity={1}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={
                    !isLoading
                  }
                  animationDuration={500}
                />

                <Line
                  type="monotone"
                  dataKey="price"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: chartColor,
                    stroke:
                      "var(--background)",
                    strokeWidth: 2,
                  }}
                  stroke={chartColor}
                  strokeWidth={2.25}
                  isAnimationActive={
                    !isLoading
                  }
                  animationDuration={500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bottom status */}
        <div
          className="
            mt-1
            flex
            items-center
            justify-between
            border-t
            border-border/50
            pt-3
          "
        >
          <div
            className="
              text-[11px]
              text-muted-foreground
            "
          >
            {chartData.length > 0
              ? `${chartData.length.toLocaleString()} data points`
              : "No data"}
          </div>

          <div
            className="
              text-[11px]
              text-muted-foreground
            "
          >
            Updated automatically
          </div>
        </div>
      </div>
    </div>
  );
}