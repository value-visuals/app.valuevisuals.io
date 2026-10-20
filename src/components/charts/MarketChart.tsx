"use client";

import React from "react";
import useSWR from "swr";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  YAxis,
} from "recharts";

import { useCurrency } from "@/components/Currency";

/* =========================================================
 * Types
 * ======================================================= */

type CryptoAsset =
  | "bitcoin"
  | "ethereum"
  | "monero";

type MetalAsset =
  | "gold"
  | "silver";

type MarketAsset =
  | CryptoAsset
  | MetalAsset;

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
      datetime?: number | string;

      close?: number | string;
      c?: number | string;

      price?: number | string;
      p?: number | string;

      value?: number | string;

      open?: number | string;
      o?: number | string;

      high?: number | string;
      h?: number | string;

      low?: number | string;
      l?: number | string;

      [key: string]: unknown;
    };

type ChartResponse = {
  symbol?: string;
  currency?: string;
  interval?: string;
  range?: string;
  days?: number;

  candles?: ChartCandle[];
  prices?: [number, number][];
  points?: ChartCandle[];

  provider?: string;
  convertedFrom?: string;
  updatedAt?: string | number;

  error?: string;
  detail?: string;

  [key: string]: unknown;
};

/* =========================================================
 * Asset metadata
 * ======================================================= */

const CRYPTO_META: Record<
  CryptoAsset,
  {
    symbol: "BTC" | "ETH" | "XMR";
    color: string;
  }
> = {
  bitcoin: {
    symbol: "BTC",
    color: "#F7931A",
  },

  ethereum: {
    symbol: "ETH",
    color: "#627EEA",
  },

  monero: {
    symbol: "XMR",
    color: "#FF6600",
  },
};

const METAL_META: Record<
  MetalAsset,
  {
    symbol: "XAU" | "XAG";
    color: string;
  }
> = {
  gold: {
    symbol: "XAU",
    color: "#FFD700",
  },

  silver: {
    symbol: "XAG",
    color: "#C0C0C0",
  },
};

/* =========================================================
 * Timestamp helper
 * ======================================================= */

function normalizeTimestamp(
  value: unknown
): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return NaN;
  }

  /*
   * Unix seconds → milliseconds.
   */
  if (
    number > 0 &&
    number < 100_000_000_000
  ) {
    return number * 1000;
  }

  return number;
}

/* =========================================================
 * Convert API response to chart points
 * ======================================================= */

function toChartData(
  payload:
    | ChartResponse
    | undefined
): ChartPoint[] {
  if (!payload) {
    return [];
  }

  /*
   * -------------------------------------------------------
   * CoinGecko-style:
   *
   * prices: [
   *   [timestamp, price],
   *   ...
   * ]
   * -------------------------------------------------------
   */

  if (
    Array.isArray(payload.prices)
  ) {
    return payload.prices
      .map(
        (
          point
        ): ChartPoint | null => {
          if (
            !Array.isArray(point) ||
            point.length < 2
          ) {
            return null;
          }

          const t =
            normalizeTimestamp(
              point[0]
            );

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
        }
      )
      .filter(
        (
          point
        ): point is ChartPoint =>
          point !== null
      )
      .sort(
        (a, b) =>
          a.t - b.t
      );
  }

  /*
   * -------------------------------------------------------
   * Generic candles / points
   * -------------------------------------------------------
   */

  const source =
    Array.isArray(payload.points)
      ? payload.points
      : Array.isArray(
          payload.candles
        )
        ? payload.candles
        : [];

  if (!source.length) {
    return [];
  }

  return source
    .map(
      (
        row
      ): ChartPoint | null => {
        /*
         * Array candle.
         *
         * Supports:
         *
         * [timestamp, price]
         *
         * and:
         *
         * [timestamp, open, high, low, close]
         */
        if (
          Array.isArray(row)
        ) {
          if (row.length < 2) {
            return null;
          }

          const t =
            normalizeTimestamp(
              row[0]
            );

          const price =
            Number(
              row.length >= 5
                ? row[4]
                : row[1]
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

        /*
         * Object candle.
         */
        if (
          row &&
          typeof row === "object"
        ) {
          const t =
            normalizeTimestamp(
              row.t ??
                row.time ??
                row.timestamp ??
                row.datetime
            );

          const price =
            Number(
              row.p ??
                row.price ??
                row.value ??
                row.c ??
                row.close ??
                row.o
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
      }
    )
    .filter(
      (
        point
      ): point is ChartPoint =>
        point !== null
    )
    .filter(
      (point) =>
        point.price >= 0
    )
    .sort(
      (a, b) =>
        a.t - b.t
    );
}

/* =========================================================
 * Fetcher
 * ======================================================= */

async function fetchChart(
  url: string
): Promise<ChartResponse> {
  const response =
    await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept:
          "application/json",
      },
    });

  const body =
    await response
      .json()
      .catch(() => ({}));

  if (!response.ok) {
    const message =
      body?.error ||
      body?.detail ||
      `Chart request failed: ${response.status} ${response.statusText}`;

    throw new Error(message);
  }

  if (
    body &&
    typeof body === "object" &&
    typeof body.error === "string"
  ) {
    throw new Error(
      body.error
    );
  }

  return body as ChartResponse;
}

/* =========================================================
 * Tooltip
 * ======================================================= */

function MarketChartTooltip({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: Array<{
    value?: unknown;
  }>;
  label?: unknown;
  currency: string;
}) {
  if (
    !active ||
    !payload?.length
  ) {
    return null;
  }

  const price =
    Number(
      payload[0]?.value
    );

  if (!Number.isFinite(price)) {
    return null;
  }

  const timestamp =
    Number(label);

  const date =
    new Date(timestamp);

  if (
    !Number.isFinite(
      date.getTime()
    )
  ) {
    return null;
  }

  let formattedPrice: string;

  try {
    formattedPrice =
      new Intl.NumberFormat(
        undefined,
        {
          style: "currency",
          currency,
          minimumFractionDigits:
            price >= 1 ? 2 : 4,
          maximumFractionDigits:
            price >= 1 ? 2 : 6,
        }
      ).format(price);
  } catch {
    formattedPrice =
      price.toLocaleString(
        undefined,
        {
          maximumFractionDigits: 6,
        }
      );
  }

  return (
    <div
      className="
        rounded-lg
        border
        border-border/70
        bg-popover/95
        px-2.5
        py-1.5
        text-popover-foreground
        shadow-lg
        backdrop-blur-md
      "
    >
      <div className="text-[10px] text-muted-foreground">
        {date.toLocaleString(
          undefined,
          {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          }
        )}
      </div>

      <div className="mt-0.5 text-xs font-semibold tabular-nums">
        {formattedPrice}
      </div>
    </div>
  );
}

/* =========================================================
 * MarketChart
 *
 * Compact CoinGecko-style 7D sparkline for MarketList.
 * ======================================================= */

export default function MarketChart({
  asset,
  className = "",
}: {
  asset: MarketAsset;
  className?: string;
}) {
  const { currency } =
    useCurrency();

  const normalizedCurrency =
    String(currency)
      .toUpperCase();

  const isCrypto =
    asset === "bitcoin" ||
    asset === "ethereum" ||
    asset === "monero";

  const meta = isCrypto
    ? CRYPTO_META[
        asset as CryptoAsset
      ]
    : METAL_META[
        asset as MetalAsset
      ];

  /* =======================================================
   * API URL
   *
   * ALWAYS 7D.
   * ===================================================== */

  const url =
    React.useMemo(() => {
      if (isCrypto) {
        const coin =
          asset as CryptoAsset;

        return (
          `/api/crypto/chart` +
          `?symbol=${encodeURIComponent(
            meta.symbol
          )}` +
          `&range=7d` +
          `&interval=auto` +
          `&currency=${encodeURIComponent(
            normalizedCurrency
          )}` +
          `&coin=${encodeURIComponent(
            coin
          )}` +
          `&days=7`
        );
      }

      const metal =
        asset as MetalAsset;

      /*
       * MetalsChart currently uses USD,
       * EUR, or GBP for metals.
       */
      const metalCurrency =
        [
          "USD",
          "EUR",
          "GBP",
        ].includes(
          normalizedCurrency
        )
          ? normalizedCurrency
          : "USD";

      return (
        `/api/metals/chart` +
        `?metal=${encodeURIComponent(
          metal
        )}` +
        `&symbol=${encodeURIComponent(
          `${meta.symbol}/${metalCurrency}`
        )}` +
        `&range=7d` +
        `&days=7` +
        `&currency=${encodeURIComponent(
          metalCurrency
        )}`
      );
    }, [
      asset,
      isCrypto,
      meta.symbol,
      normalizedCurrency,
    ]);

  /* =======================================================
   * Data
   * ===================================================== */

  const {
    data,
    error,
    isLoading,
  } =
    useSWR<ChartResponse>(
      url,
      fetchChart,
      {
        refreshInterval:
          60_000,

        revalidateOnFocus:
          false,

        keepPreviousData:
          true,
      }
    );

  /* =======================================================
   * Chart data
   * ===================================================== */

  const chartData =
    React.useMemo(() => {
      return toChartData(
        data
      );
    }, [data]);

  /* =======================================================
   * Tight Y-axis scaling
   *
   * This is what prevents the 7D sparkline from appearing
   * as a flat line when the absolute price is large but the
   * actual 7D movement is relatively small.
   * ===================================================== */

  const {
    yMin,
    yMax,
  } = React.useMemo(() => {
    if (
      chartData.length === 0
    ) {
      return {
        yMin: 0,
        yMax: 1,
      };
    }

    const prices =
      chartData.map(
        (point) =>
          point.price
      );

    const minPrice =
      Math.min(...prices);

    const maxPrice =
      Math.max(...prices);

    const priceRange =
      maxPrice - minPrice;

    /*
     * Give the line a small amount of
     * breathing room without allowing
     * the chart to flatten.
     */
    const padding =
      priceRange === 0
        ? Math.max(
            Math.abs(maxPrice) *
              0.001,
            0.01
          )
        : priceRange * 0.15;

    return {
      yMin:
        minPrice - padding,

      yMax:
        maxPrice + padding,
    };
  }, [chartData]);

  /* =======================================================
   * Determine 7D direction
   * ===================================================== */

  const isPositive =
    chartData.length >= 2
      ? chartData[
          chartData.length - 1
        ].price >=
        chartData[0].price
      : true;

  /*
   * Positive = asset color.
   * Negative = red.
   */
  const chartColor =
  !isCrypto
    ? meta.color
    : chartData.length >= 2
      ? isPositive
        ? meta.color
        : "#EF4444"
      : meta.color;

  const gradientId =
    `market-chart-gradient-${asset}`;

  /* =======================================================
   * Error logging
   * ===================================================== */

  React.useEffect(() => {
    if (!error) {
      return;
    }

    console.error(
      `[MarketChart:${asset}] chart request failed`,
      {
        url,
        error,
      }
    );
  }, [
    asset,
    error,
    url,
  ]);

  /* =======================================================
   * Loading
   * ===================================================== */

  if (
    isLoading &&
    chartData.length === 0
  ) {
    return (
      <div
        className={`
          h-10
          w-full
          min-w-[100px]
          animate-pulse
          rounded-md
          bg-muted/50
          ${className}
        `}
        aria-label={`${asset} 7 day chart loading`}
      />
    );
  }

  /* =======================================================
   * Empty / error
   * ===================================================== */

  if (
    error ||
    chartData.length < 2
  ) {
    return (
      <div
        className={`
          flex
          h-10
          w-full
          min-w-[100px]
          items-center
          justify-center
          text-xs
          text-muted-foreground
          ${className}
        `}
        aria-label={`${asset} 7 day chart unavailable`}
      >
        —
      </div>
    );
  }

  /* =======================================================
   * Chart
   *
   * CoinGecko-style:
   * - tight Y-axis
   * - no visible axes
   * - no grid
   * - no legend
   * - compact height
   * - subtle fill
   * - strong line
   * ===================================================== */

  return (
    <div
      className={`
        h-10
        w-full
        min-w-[100px]
        ${className}
      `}
      aria-label={`${asset} 7 day price chart`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
      >
        <AreaChart
          data={chartData}
          margin={{
            top: 3,
            right: 1,
            bottom: 3,
            left: 1,
          }}
        >
          <YAxis
            hide
            domain={[
              yMin,
              yMax,
            ]}
          />

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
                  chartColor
                }
                stopOpacity={0.18}
              />

              <stop
                offset="100%"
                stopColor={
                  chartColor
                }
                stopOpacity={0}
              />
            </linearGradient>
          </defs>

          <Tooltip
            cursor={{
              stroke:
                chartColor,
              strokeOpacity: 0.25,
              strokeWidth: 1,
            }}
            content={
              <MarketChartTooltip
                currency={
                  isCrypto
                    ? normalizedCurrency
                    : [
                          "USD",
                          "EUR",
                          "GBP",
                        ].includes(
                          normalizedCurrency
                        )
                      ? normalizedCurrency
                      : "USD"
                }
              />
            }
          />

          <Area
            type="monotone"
            dataKey="price"
            stroke={
              chartColor
            }
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            fillOpacity={1}
            dot={false}
            activeDot={{
              r: 3,
              stroke:
                chartColor,
              strokeWidth: 1.5,
              fill: "hsl(var(--card))",
            }}
            isAnimationActive
            animationDuration={450}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
