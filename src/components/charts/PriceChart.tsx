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
} from "recharts";

/* =========================================================
 * Types
 * ======================================================= */

type ChartPoint = {
  t: number;
  price: number;
};

type ChartCandle =
  | number[]
  | {
      time?: number | string;
      t?: number | string;
      timestamp?: number | string;

      close?: number | string;
      c?: number | string;
      price?: number | string;

      open?: number | string;
      o?: number | string;

      high?: number | string;
      h?: number | string;

      low?: number | string;
      l?: number | string;
    };

type CryptoChartResponse = {
  symbol?: string;
  currency?: string;
  interval?: string;
  range?: string;
  days?: number;

  candles?: ChartCandle[];
  prices?: [number, number][];

  provider?: string;
  convertedFrom?: string;
  updatedAt?: string | number;

  error?: string;
  detail?: string;

  [key: string]: unknown;
};

/* =========================================================
 * Coin metadata
 * ======================================================= */

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

/* =========================================================
 * Ranges
 * ======================================================= */

const RANGES = [
  {
    label: "1D",
    value: "1d",
    days: 1,
  },
  {
    label: "2D",
    value: "2d",
    days: 2,
  },
  {
    label: "3D",
    value: "3d",
    days: 3,
  },
  {
    label: "1W",
    value: "7d",
    days: 7,
  },
  {
    label: "2W",
    value: "14d",
    days: 14,
  },
  {
    label: "1M",
    value: "30d",
    days: 30,
  },
  {
    label: "2M",
    value: "60d",
    days: 60,
  },
  {
    label: "3M",
    value: "90d",
    days: 90,
  },
  {
    label: "6M",
    value: "180d",
    days: 180,
  },
  {
    label: "1Y",
    value: "365d",
    days: 365,
  },
];

/* =========================================================
 * Timestamp normalization
 *
 * Backend data can arrive in:
 *
 *   seconds
 *   milliseconds
 * ======================================================= */

function normalizeTimestamp(
  value: unknown
): number {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return NaN;
  }

  /*
   * Unix seconds are currently ~1.7 billion.
   * Unix milliseconds are ~1.7 trillion.
   */
  if (n > 0 && n < 100_000_000_000) {
    return n * 1000;
  }

  return n;
}

/* =========================================================
 * Chart response → chart points
 * ======================================================= */

function toChartData(
  payload: CryptoChartResponse | undefined
): ChartPoint[] {
  if (!payload) {
    return [];
  }

  /*
   * -------------------------------------------------------
   * Format 1:
   *
   * {
   *   prices: [
   *     [timestamp, price],
   *     ...
   *   ]
   * }
   * -------------------------------------------------------
   */

  if (Array.isArray(payload.prices)) {
    return payload.prices
      .map((point) => {
        if (
          !Array.isArray(point) ||
          point.length < 2
        ) {
          return null;
        }

        const t =
          normalizeTimestamp(point[0]);

        const price =
          Number(point[1]);

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
      })
      .filter(
        (
          point
        ): point is ChartPoint =>
          point !== null
      );
  }

  /*
   * -------------------------------------------------------
   * Format 2:
   *
   * candles: [
   *   {
   *     timestamp,
   *     open,
   *     high,
   *     low,
   *     close
   *   }
   * ]
   *
   * Also supports aliases:
   *
   * t / time
   * c / close
   * -------------------------------------------------------
   */

  if (!Array.isArray(payload.candles)) {
    return [];
  }

  return payload.candles
    .map(
      (
        candle
      ): ChartPoint | null => {
        /*
         * -------------------------------------------------
         * Array candle
         *
         * [timestamp, close]
         *
         * OR standard OHLC:
         *
         * [timestamp, open, high, low, close]
         * -------------------------------------------------
         */

        if (Array.isArray(candle)) {
          if (candle.length < 2) {
            return null;
          }

          const t =
            normalizeTimestamp(candle[0]);

          let price: number;

          if (candle.length >= 5) {
            price =
              Number(candle[4]);
          } else {
            price =
              Number(candle[1]);
          }

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

        /*
         * -------------------------------------------------
         * Object candle
         * -------------------------------------------------
         */

        const t =
          normalizeTimestamp(
            candle.time ??
              candle.t ??
              candle.timestamp
          );

        const price =
          Number(
            candle.close ??
              candle.c ??
              candle.price ??
              candle.o
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
    )
    .filter(
      (
        point
      ): point is ChartPoint =>
        point !== null
    );
}

/* =========================================================
 * Formatting
 * ======================================================= */

function formatMoney(
  n: number,
  currency: string
) {
  const v = Number(n);

  if (!Number.isFinite(v)) {
    return "";
  }

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency,
        notation: "compact",
        maximumFractionDigits: 2,
      }
    ).format(v);
  } catch {
    return String(v);
  }
}

function formatFullMoney(
  n: number,
  currency: string
) {
  const v = Number(n);

  if (!Number.isFinite(v)) {
    return "";
  }

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    ).format(v);
  } catch {
    return String(v);
  }
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
    return d.toLocaleTimeString(
      undefined,
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  if (totalDays <= 3) {
    return d.toLocaleString(
      undefined,
      {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  return d.toLocaleDateString(
    undefined,
    {
      month: "short",
      day: "numeric",
    }
  );
}

function formatPercent(
  value: number
) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }

  return `${
    value >= 0 ? "+" : ""
  }${value.toFixed(2)}%`;
}

/* =========================================================
 * Change calculation
 * ======================================================= */

function getChange(
  data: ChartPoint[]
) {
  if (data.length < 2) {
    return {
      change: 0,
      percent: 0,
    };
  }

  const first =
    data[0].price;

  const last =
    data[data.length - 1].price;

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

  const change =
    last - first;

  const percent =
    (change / first) * 100;

  return {
    change,
    percent,
  };
}

/* =========================================================
 * X-axis tick generation
 * ======================================================= */

function generateLocalTimeTicks(
  min: number,
  max: number,
  hours: number
): number[] {
  const ticks: number[] = [];

  const start =
    new Date(min);

  start.setMinutes(
    0,
    0,
    0
  );

  const remainder =
    start.getHours() % hours;

  if (remainder !== 0) {
    start.setHours(
      start.getHours() +
        (hours - remainder)
    );
  }

  let cursor =
    start.getTime();

  while (cursor <= max) {
    if (cursor >= min) {
      ticks.push(cursor);
    }

    const nextDate =
      new Date(cursor);

    nextDate.setHours(
      nextDate.getHours() +
        hours
    );

    const next =
      nextDate.getTime();

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

  const start =
    new Date(min);

  start.setHours(
    0,
    0,
    0,
    0
  );

  while (
    start.getTime() < min
  ) {
    start.setDate(
      start.getDate() +
        everyDays
    );
  }

  let cursor =
    start.getTime();

  while (cursor <= max) {
    if (cursor >= min) {
      ticks.push(cursor);
    }

    const nextDate =
      new Date(cursor);

    nextDate.setDate(
      nextDate.getDate() +
        everyDays
    );

    const next =
      nextDate.getTime();

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

  const start =
    new Date(min);

  start.setDate(1);
  start.setHours(
    0,
    0,
    0,
    0
  );

  if (
    start.getTime() < min
  ) {
    start.setMonth(
      start.getMonth() + 1
    );
  }

  let cursor =
    start.getTime();

  while (cursor <= max) {
    if (cursor >= min) {
      ticks.push(cursor);
    }

    const nextDate =
      new Date(cursor);

    nextDate.setMonth(
      nextDate.getMonth() + 1
    );

    const next =
      nextDate.getTime();

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

  const min =
    points[0].t;

  const max =
    points[
      points.length - 1
    ].t;

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min >= max
  ) {
    return [min];
  }

  /*
   * 1D:
   * every 4 hours
   */
  if (totalDays <= 1) {
    return generateLocalTimeTicks(
      min,
      max,
      4
    );
  }

  /*
   * 2D / 3D:
   * every 6 hours
   */
  if (totalDays <= 3) {
    return generateLocalTimeTicks(
      min,
      max,
      6
    );
  }

  /*
   * 1W / 2W:
   * every 2 days
   */
  if (totalDays <= 14) {
    return generateLocalDayTicks(
      min,
      max,
      2
    );
  }

  /*
   * 1M / 2M / 3M:
   * every week
   */
  if (totalDays <= 90) {
    return generateLocalDayTicks(
      min,
      max,
      7
    );
  }

  /*
   * 6M:
   * every 2 weeks
   */
  if (totalDays <= 180) {
    return generateLocalDayTicks(
      min,
      max,
      14
    );
  }

  /*
   * 1Y:
   * monthly
   */
  return generateLocalMonthTicks(
    min,
    max
  );
}

/* =========================================================
 * SWR fetcher
 * ======================================================= */

async function fetchChart(
  url: string
): Promise<CryptoChartResponse> {
  const response =
    await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept:
          "application/json",
      },
    });

  const body =
    await response
      .json()
      .catch(() => ({}));

  /*
   * HTTP failure.
   */
  if (!response.ok) {
    const message =
      body?.error ||
      body?.detail ||
      `Chart request failed: ${response.status} ${response.statusText}`;

    throw new Error(message);
  }

  /*
   * The route returned HTTP 200,
   * but protect against an API-level
   * error payload anyway.
   */
  if (
    body &&
    typeof body === "object" &&
    typeof body.error === "string"
  ) {
    throw new Error(
      body.error
    );
  }

  return body as CryptoChartResponse;
}

/* =========================================================
 * Component
 * ======================================================= */

export default function PriceChart({
  coin,
  className = "",
}: {
  coin:
    | "bitcoin"
    | "ethereum"
    | "monero";

  className?: string;
}) {
  const meta =
    COIN_META[coin];

  const [
    range,
    setRange,
  ] = React.useState<string>(
    "1d"
  );

  const [
    justUpdated,
    setJustUpdated,
  ] = React.useState(false);

  const [
    hoveredPrice,
    setHoveredPrice,
  ] = React.useState<
    number | null
  >(null);

  const selected =
    RANGES.find(
      (r) => r.value === range
    ) ?? RANGES[0];

  const { currency } =
    useCurrency();

  /*
   * IMPORTANT:
   *
   * Keep currency uppercase when
   * sending it to the backend.
   */
  const normalizedCurrency =
    String(currency).toUpperCase();

  /*
   * The frontend route accepts both
   * the old coin/days parameters and
   * the new symbol/range parameters.
   *
   * We send the complete request so
   * the route has everything it needs.
   */
  const url = React.useMemo(
    () =>
      `/api/crypto/chart` +
      `?symbol=${encodeURIComponent(
        meta.symbol
      )}` +
      `&range=${encodeURIComponent(
        range
      )}` +
      `&interval=auto` +
      `&currency=${encodeURIComponent(
        normalizedCurrency
      )}` +
      `&coin=${encodeURIComponent(
        coin
      )}` +
      `&days=${selected.days}`,
    [
      meta.symbol,
      range,
      normalizedCurrency,
      coin,
      selected.days,
    ]
  );

  const {
    data,
    error,
    isLoading,
    isValidating,
  } = useSWR<CryptoChartResponse>(
    url,
    fetchChart,
    {
      refreshInterval:
        60_000,

      revalidateOnFocus:
        false,

      keepPreviousData:
        true,

      onSuccess: () => {
        setJustUpdated(
          true
        );

        window.setTimeout(
          () => {
            setJustUpdated(
              false
            );
          },
          1500
        );
      },
    }
  );

  /*
   * Convert API response into
   * the exact structure Recharts
   * expects.
   */
  const chartData =
    React.useMemo(() => {
      const points =
        toChartData(data);

      return points
        .filter(
          (point) =>
            Number.isFinite(
              point.t
            ) &&
            Number.isFinite(
              point.price
            ) &&
            point.price >= 0
        )
        .sort(
          (a, b) =>
            a.t - b.t
        );
    }, [data]);

  /*
   * Latest price.
   */
  const latestPrice =
    chartData.length > 0
      ? chartData[
          chartData.length - 1
        ].price
      : null;

  /*
   * Change.
   */
  const {
    change,
    percent,
  } =
    getChange(chartData);

  const isPositive =
    percent >= 0;

  const chartColor =
    meta.color;

  /*
   * X-axis ticks.
   */
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

  /*
   * Unique gradient ID.
   */
  const gradientId =
    `price-gradient-${coin}`;

  /*
   * Debug information is intentionally
   * only emitted when something is wrong.
   */
  React.useEffect(() => {
    if (error) {
      console.error(
        `[PriceChart:${meta.symbol}] chart request failed`,
        {
          url,
          error,
        }
      );

      return;
    }

    if (
      data &&
      chartData.length === 0
    ) {
      console.warn(
        `[PriceChart:${meta.symbol}] API returned successfully but no chart points were parsed`,
        {
          url,
          response: data,
        }
      );
    }
  }, [
    error,
    data,
    chartData.length,
    meta.symbol,
    url,
  ]);

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
      {/* Top accent */}
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
        {/* =================================================
         * Header
         * =============================================== */}

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
                {latestPrice !==
                null
                  ? formatFullMoney(
                      latestPrice,
                      normalizedCurrency
                    )
                  : "—"}
              </span>

              {chartData.length >
                1 && (
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

            {chartData.length >
              1 && (
              <div className="mt-1 text-xs text-muted-foreground">
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
                className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
                style={{
                  backgroundColor:
                    chartColor,
                }}
              />

              <span
                className="relative inline-flex size-1.5 rounded-full"
                style={{
                  backgroundColor:
                    chartColor,
                }}
              />
            </span>

            Live
          </div>
        </div>

        {/* =================================================
         * Timeframe toolbar
         * =============================================== */}

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
            {RANGES.map(
              (r) => {
                const active =
                  r.value ===
                  range;

                return (
                  <button
                    key={r.value}
                    type="button"
                    role="tab"
                    aria-selected={
                      active
                    }
                    onClick={() => {
                      setRange(
                        r.value
                      );

                      setHoveredPrice(
                        null
                      );
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
              }
            )}
          </div>

          <div className="hidden shrink-0 text-[11px] text-muted-foreground sm:block">
            {selected.label}
          </div>
        </div>

        {/* =================================================
         * Chart
         * =============================================== */}

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
          {/* Initial loading */}

          {isLoading &&
          chartData.length ===
            0 ? (
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
          ) : error &&
            chartData.length ===
              0 ? (
            /* API error */

            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="text-sm font-medium text-destructive">
                Unable to load chart
              </div>

              <div className="max-w-md text-xs text-muted-foreground">
                {error instanceof
                Error
                  ? error.message
                  : "The chart request failed."}
              </div>
            </div>
          ) : chartData.length ===
            0 ? (
            /* Successful request, but
             * no usable points */

            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <div className="text-sm text-muted-foreground">
                No chart data available.
              </div>

              {data && (
                <div className="text-[10px] text-muted-foreground/60">
                  {meta.symbol} ·{" "}
                  {selected.label}
                </div>
              )}
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
                {/* =================================================
                 * Gradient
                 * =============================================== */}

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
                      stopColor={
                        meta.color
                      }
                      stopOpacity={
                        0.4
                      }
                    />

                    <stop
                      offset="100%"
                      stopColor={
                        meta.color
                      }
                      stopOpacity={
                        0
                      }
                    />
                  </linearGradient>
                </defs>

                {/* Grid */}

                <CartesianGrid
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                />

                {/* =================================================
                 * X Axis
                 * =============================================== */}

                <XAxis
                  type="number"
                  dataKey="t"
                  domain={[
                    "dataMin",
                    "dataMax",
                  ]}
                  scale="time"
                  ticks={
                    xAxisTicks
                  }
                  tickFormatter={(
                    value
                  ) =>
                    formatXAxis(
                      Number(
                        value
                      ),
                      selected.days
                    )
                  }
                  minTickGap={
                    selected.days <=
                    3
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

                {/* =================================================
                 * Y Axis
                 * =============================================== */}

                <YAxis
                  domain={[
                    "auto",
                    "auto",
                  ]}
                  tickFormatter={(
                    value
                  ) =>
                    formatMoney(
                      Number(
                        value
                      ),
                      normalizedCurrency
                    )
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

                {/* =================================================
                 * Tooltip
                 * =============================================== */}

                <Tooltip
                  cursor={{
                    stroke:
                      meta.color,
                    strokeWidth: 1,
                    strokeDasharray:
                      "4 4",
                    strokeOpacity:
                      0.55,
                  }}
                  formatter={(
                    value
                  ) =>
                    formatMoney(
                      Number(
                        value
                      ),
                      normalizedCurrency
                    )
                  }
                  labelFormatter={(
                    value
                  ) => {
                    const ts =
                      Number(
                        value
                      );

                    if (
                      !Number.isFinite(
                        ts
                      )
                    ) {
                      return "";
                    }

                    const d =
                      new Date(
                        ts
                      );

                    if (
                      selected.days <=
                      3
                    ) {
                      return d.toLocaleString(
                        undefined,
                        {
                          month:
                            "short",
                          day:
                            "numeric",
                          hour:
                            "2-digit",
                          minute:
                            "2-digit",
                        }
                      );
                    }

                    return d.toLocaleString(
                      undefined,
                      {
                        month:
                          "short",
                        day:
                          "numeric",
                        year:
                          selected.days >=
                          30
                            ? "numeric"
                            : undefined,
                      }
                    );
                  }}
                  contentStyle={{
                    background:
                      "var(--popover)",
                    border:
                      "1px solid var(--border)",
                    color:
                      "var(--popover-foreground)",
                    borderRadius:
                      "0.75rem",
                    boxShadow:
                      "0 8px 24px rgba(0, 0, 0, 0.12)",
                  }}
                  labelStyle={{
                    color:
                      "var(--muted-foreground)",
                  }}
                  itemStyle={{
                    color:
                      meta.color,
                    fontWeight: 600,
                  }}
                />

                {/* =================================================
                 * Area
                 * =============================================== */}

                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="none"
                  fillOpacity={1}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={
                    !isLoading
                  }
                  animationDuration={
                    500
                  }
                />

                {/* =================================================
                 * Price line
                 * =============================================== */}

                <Line
                  type="monotone"
                  dataKey="price"
                  dot={false}
                  activeDot={{
                    r: 5,
                    fill:
                      meta.color,
                    stroke:
                      "var(--background)",
                    strokeWidth: 2,
                  }}
                  stroke={
                    meta.color
                  }
                  strokeWidth={
                    2.25
                  }
                  isAnimationActive={
                    !isLoading
                  }
                  animationDuration={
                    500
                  }
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {/* Background refresh indicator */}

          {isValidating &&
            chartData.length >
              0 && (
              <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-background/80 px-2 py-1 text-[9px] font-medium text-muted-foreground shadow-sm backdrop-blur">
                Updating…
              </div>
            )}
        </div>

        {/* =================================================
         * Bottom status
         * =============================================== */}

        <div className="mt-1 flex items-center justify-between border-t border-border/50 pt-3">
          <div className="text-[11px] text-muted-foreground">
            {chartData.length >
            0
              ? `${chartData.length.toLocaleString()} data points`
              : "No data"}
          </div>

          <div
            className={`
              text-[11px]
              font-medium
              transition-all
              duration-700
              ${
                justUpdated
                  ? "opacity-100 text-emerald-500"
                  : "opacity-0 text-emerald-500"
              }
            `}
          >
            Updated
          </div>
        </div>
      </div>
    </div>
  );
}