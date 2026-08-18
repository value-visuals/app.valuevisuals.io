"use client";

import React from "react";
import useSWR from "swr";
import Image from "next/image";

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

type Coin =
  | "bitcoin"
  | "ethereum"
  | "monero";

type ChartPoint = {
  t: number;
  price: number;
};

type CoinMeta = {
  name: string;
  color: string;
  logo: string;
  symbol: string;
};

const COIN_META: Record<Coin, CoinMeta> = {
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
  { label: "1D", value: "1", days: 1 },
  { label: "2D", value: "2", days: 2 },
  { label: "3D", value: "3", days: 3 },
  { label: "1W", value: "7", days: 7 },
  { label: "2W", value: "14", days: 14 },
  { label: "1M", value: "30", days: 30 },
  { label: "2M", value: "60", days: 60 },
  { label: "3M", value: "90", days: 90 },
  { label: "6M", value: "180", days: 180 },
  { label: "1Y", value: "365", days: 365 },
];

function formatRatio(value: number) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  if (value >= 100) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (value >= 10) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }

  if (value >= 1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 5,
    });
  }

  if (value >= 0.1) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: 3,
      maximumFractionDigits: 6,
    });
  }

  return value.toLocaleString(undefined, {
    maximumSignificantDigits: 7,
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

function generateLocalTimeTicks(
  min: number,
  max: number,
  hours: number
): number[] {
  const ticks: number[] = [];

  const start = new Date(min);

  start.setMinutes(0, 0, 0);

  const remainder =
    start.getHours() % hours;

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

  if (totalDays <= 1) {
    return generateLocalTimeTicks(
      min,
      max,
      4
    );
  }

  if (totalDays <= 3) {
    return generateLocalTimeTicks(
      min,
      max,
      6
    );
  }

  if (totalDays <= 14) {
    return generateLocalDayTicks(
      min,
      max,
      2
    );
  }

  if (totalDays <= 90) {
    return generateLocalDayTicks(
      min,
      max,
      7
    );
  }

  if (totalDays <= 180) {
    return generateLocalDayTicks(
      min,
      max,
      14
    );
  }

  return generateLocalMonthTicks(
    min,
    max
  );
}

function formatPairValue(
  value: number,
  base: Coin,
  quote: Coin
) {
  const baseSymbol =
    COIN_META[base].symbol;

  const quoteSymbol =
    COIN_META[quote].symbol;

  return `${formatRatio(value)} ${quoteSymbol}`;
}

function ComparisonTooltip({
  active,
  payload,
  label,
  base,
  quote,
}: {
  active?: boolean;
  payload?: any[];
  label?: number;
  base: Coin;
  quote: Coin;
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
        min-w-[170px]
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
        {formatPairValue(
          price,
          base,
          quote
        )}
      </div>

      <div className="mt-0.5 text-[10px] text-muted-foreground">
        {COIN_META[base].symbol}/
        {COIN_META[quote].symbol}
      </div>
    </div>
  );
}

export default function CryptoComparisonChart({
  initialBase = "ethereum",
  initialQuote = "bitcoin",
  className = "",
}: {
  initialBase?: Coin;
  initialQuote?: Coin;
  className?: string;
}) {
  const [base, setBase] =
    React.useState<Coin>(
      initialBase
    );

  const [quote, setQuote] =
    React.useState<Coin>(
      initialQuote
    );

  const [range, setRange] =
    React.useState("3");

  const selected =
    RANGES.find(
      (r) => r.value === range
    ) ?? RANGES[0];

  const [isSwapping, setIsSwapping] =
    React.useState(false);

  const baseMeta =
    COIN_META[base];

  const quoteMeta =
    COIN_META[quote];

  const pairColor =
    baseMeta.color;

  const url =
    `/api/crypto/compare` +
    `?base=${base}` +
    `&quote=${quote}` +
    `&days=${selected.value}`;

  const { data, isLoading } =
    useSWR<any>(
      url,
      (u) =>
        fetch(u).then((r) =>
          r.json()
        ),
      {
        refreshInterval: 60_000,
        revalidateOnFocus: false,
      }
    );

    console.log("COMPARE URL:", url);
    console.log("COMPARE RESPONSE:", data);
    console.log("COMPARE ERROR:", Error);

  const chartData: ChartPoint[] =
    Array.isArray(data?.prices)
      ? data.prices
          .map((p: any) => ({
            t: Number(p.t),
            price: Number(p.price),
          }))
          .filter(
            (p: ChartPoint) =>
              Number.isFinite(p.t) &&
              Number.isFinite(p.price) &&
              p.price > 0
          )
          .sort(
            (a: ChartPoint, b: ChartPoint) =>
              a.t - b.t
          )
      : [];

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

  const xAxisTicks =
    React.useMemo(
      () =>
        getXAxisTicks(
          chartData,
          selected.days
        ),
      [
        chartData,
        selected.days,
      ]
    );

  const swapPair = () => {
    if (isSwapping) {
      return;
    }

    setIsSwapping(true);

    setBase(quote);
    setQuote(base);

    window.setTimeout(() => {
      setIsSwapping(false);
    }, 150);
  };

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
      <div
        className="absolute inset-x-0 top-0 h-px opacity-70"
        style={{
          background: `linear-gradient(
            90deg,
            transparent,
            ${pairColor},
            transparent
          )`,
        }}
      />

      <div className="p-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">

            {/* Pair identity */}
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
                  src={baseMeta.logo}
                  alt={baseMeta.name}
                  width={20}
                  height={20}
                  className="size-5 object-contain"
                />
              </div>

              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold tracking-tight">
                    {baseMeta.symbol} priced in {quoteMeta.symbol}
                </h3>

                <div
                  className="
                    flex
                    size-6
                    items-center
                    justify-center
                    rounded-full
                    bg-muted/60
                    ring-1
                    ring-border/60
                  "
                >
                  <Image
                    src={quoteMeta.logo}
                    alt={quoteMeta.name}
                    width={16}
                    height={16}
                    className="size-4 object-contain"
                  />
                </div>

                <span className="text-xs font-medium text-muted-foreground">
                  {quoteMeta.symbol}
                </span>
              </div>
            </div>

            {/* Current ratio */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-2xl font-bold tracking-tight sm:text-3xl">
                {latestPrice !== null
                  ? formatPairValue(
                      latestPrice,
                      base,
                      quote
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
                  {formatPercent(percent)}
                </span>
              )}
            </div>

            {chartData.length > 1 && (
              <div className="mt-1 text-xs text-muted-foreground">
                {isPositive
                  ? "+"
                  : ""}
                {formatPairValue(
                  change,
                  base,
                  quote
                )}{" "}
                over{" "}
                {selected.label}
              </div>
            )}
          </div>

          {/* Live */}
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
                style={{
                  backgroundColor:
                    pairColor,
                }}
              />

              <span
                className="relative inline-flex size-1.5 rounded-full"
                style={{
                  backgroundColor:
                    pairColor,
                }}
              />
            </span>

            Live
          </div>
        </div>

        {/* Pair controls */}
        <div className="mt-5 flex flex-wrap items-center gap-2">

          <div
            className="
              flex
              items-center
              gap-1
              rounded-lg
              bg-muted/50
              p-1
            "
          >
            <select
              value={base}
              onChange={(e) =>
                setBase(
                  e.target.value as Coin
                )
              }
              className="
                h-7
                rounded-md
                border-0
                bg-background
                px-2
                text-[11px]
                font-semibold
                text-foreground
                shadow-sm
                outline-none
                ring-1
                ring-border/60
              "
            >
              {(
                Object.keys(
                  COIN_META
                ) as Coin[]
              ).map((coin) => (
                <option
                  key={coin}
                  value={coin}
                  disabled={
                    coin === quote
                  }
                >
                  {COIN_META[coin].symbol}
                  {" — "}
                  {COIN_META[coin].name}
                </option>
              ))}
            </select>

            <span className="px-1 text-xs font-semibold text-muted-foreground">
              /
            </span>

            <select
              value={quote}
              onChange={(e) =>
                setQuote(
                  e.target.value as Coin
                )
              }
              className="
                h-7
                rounded-md
                border-0
                bg-background
                px-2
                text-[11px]
                font-semibold
                text-foreground
                shadow-sm
                outline-none
                ring-1
                ring-border/60
              "
            >
              {(
                Object.keys(
                  COIN_META
                ) as Coin[]
              ).map((coin) => (
                <option
                  key={coin}
                  value={coin}
                  disabled={
                    coin === base
                  }
                >
                  {COIN_META[coin].symbol}
                  {" — "}
                  {COIN_META[coin].name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={swapPair}
            disabled={isSwapping}
            aria-label="Swap comparison pair"
            title="Swap pair"
            className="
              flex
              size-7
              items-center
              justify-center
              rounded-md
              border
              border-border/60
              bg-muted/40
              text-muted-foreground
              transition-colors
              hover:bg-muted
              hover:text-foreground
              focus:outline-none
              focus-visible:ring-2
              focus-visible:ring-ring
            "
          >
            ⇄
          </button>

        </div>

        {/* Timeframe */}
        <div className="mt-3 flex items-center justify-between gap-3">

          <div
            role="tablist"
            aria-label="Comparison chart range"
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
          {isLoading &&
          chartData.length === 0 ? (
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

                Loading comparison…
              </div>
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No comparison data available.
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
                    id="comparison-gradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={
                        pairColor
                      }
                      stopOpacity={0.4}
                    />

                    <stop
                      offset="100%"
                      stopColor={
                        pairColor
                      }
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />

                <XAxis
                  type="number"
                  dataKey="t"
                  domain={[
                    "dataMin",
                    "dataMax",
                  ]}
                  scale="time"
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
                    fill: "var(--muted-foreground)",
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
                  tickFormatter={(value) =>
                    formatRatio(
                      Number(value)
                    )
                  }
                  orientation="right"
                  width={65}
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
                    stroke: pairColor,
                    strokeWidth: 1,
                    strokeDasharray: "4 4",
                    strokeOpacity: 0.55,
                  }}
                  content={
                    <ComparisonTooltip
                      base={base}
                      quote={quote}
                    />
                  }
                />

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="none"
                  fillOpacity={1}
                  fill="url(#comparison-gradient)"
                  isAnimationActive={!isLoading}
                  animationDuration={500}
                />

                <Line
                  type="monotone"
                  dataKey="price"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill: pairColor,
                    stroke:
                      "var(--background)",
                    strokeWidth: 2,
                  }}
                  stroke={pairColor}
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