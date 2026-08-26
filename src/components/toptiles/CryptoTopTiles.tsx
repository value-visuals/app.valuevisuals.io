// components/toptiles/CryptoTopTiles.tsx

"use client";

import { useEffect } from "react";

import TopTile from "./TopTile";

import { useCurrency } from "../Currency";

import {
  useMarketStore,
  type CoinStats,
} from "@/stores/marketStore";

type CryptoAsset =
  | "bitcoin"
  | "ethereum"
  | "monero";

type CryptoTopTilesProps = {
  asset: CryptoAsset;
  className?: string;
};

const assetConfig: Record<
  CryptoAsset,
  {
    symbol: string;
    statsKey:
      | "bitcoinStats"
      | "ethereumStats"
      | "moneroStats";
  }
> = {
  bitcoin: {
    symbol: "BTC",
    statsKey: "bitcoinStats",
  },

  ethereum: {
    symbol: "ETH",
    statsKey: "ethereumStats",
  },

  monero: {
    symbol: "XMR",
    statsKey: "moneroStats",
  },
};

function formatCurrency(
  value: number | null | undefined,
  currency: string
) {
  if (
    value == null ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat(
    undefined,
    {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }
  ).format(value);
}

function formatPercent(
  value: number | null | undefined
) {
  if (
    value == null ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return `${(
    value * 100
  ).toFixed(2)}%`;
}

function getChangeFraction(
  stats: CoinStats | null
) {
  if (!stats) {
    return null;
  }

  return (
    stats.change24h ??
    (stats.change24hPct != null
      ? stats.change24hPct / 100
      : null)
  );
}

export default function CryptoTopTiles({
  asset,
  className = "",
}: CryptoTopTilesProps) {
  const { currency } =
    useCurrency();

  const config =
    assetConfig[asset];

  /*
   * Same currency-aware summary
   * used by the dashboard TopTiles.
   */
  const cryptoSummary =
    useMarketStore(
      (state) =>
        state.cryptoSummary
    );

  const cryptoError =
    useMarketStore(
      (state) =>
        state.cryptoError
    );

  const fetchMarketData =
    useMarketStore(
      (state) =>
        state.fetchMarketData
    );

  /*
   * Keep the existing stats for
   * percentage change and dominance
   * while we transition the currency
   * values to cryptoSummary.
   */
  const stats =
    useMarketStore(
      (state) =>
        state[config.statsKey]
    );

  const fetchStats =
    asset === "bitcoin"
      ? useMarketStore(
          (state) =>
            state.fetchBitcoinStats
        )
      : asset === "ethereum"
        ? useMarketStore(
            (state) =>
              state.fetchEthereumStats
          )
        : useMarketStore(
            (state) =>
              state.fetchMoneroStats
          );

  const curKey =
    currency.toLowerCase() as
      | "usd"
      | "eur"
      | "gbp";

  /*
   * Fetch the same currency-aware
   * summary used by dashboard TopTiles.
   */
  useEffect(() => {
    void fetchMarketData(
      curKey
    );
  }, [
    curKey,
    fetchMarketData,
  ]);

  /*
   * Keep loading the existing
   * individual stats endpoint for
   * change/dominance.
   */
  useEffect(() => {
    if (!stats) {
      void fetchStats();
    }
  }, [
    stats,
    fetchStats,
  ]);

  /*
   * Currency-aware values from
   * cryptoSummary.
   */
  const price =
    cryptoSummary?.[
      asset
    ]?.[curKey];

  const currencyStats =
    cryptoSummary?.[
      `${asset}_stats`
    ] as
      | {
          price?: number | null;
          marketCap?:
            | number
            | null;
          volume24h?:
            | number
            | null;
          change24h?:
            | number
            | null;
          change24hPct?:
            | number
            | null;
          dominancePct?:
            | number
            | null;
        }
      | undefined;

  const marketCap =
    currencyStats?.marketCap ??
    null;

  const volume24h =
    currencyStats?.volume24h ??
    null;

  /*
   * Keep the existing change/dominance
   * behavior.
   */
  const change =
    currencyStats?.change24h ??
    getChangeFraction(stats);

  const dominance =
    currencyStats?.dominancePct ??
    stats?.dominancePct ??
    null;

  const hasError =
    !!cryptoError;

  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      <TopTile
        label={`${config.symbol} Price`}
        value={formatCurrency(
          price,
          currency
        )}
        change={change}
        error={hasError}
      />

      <TopTile
        label={`${config.symbol} Market Cap`}
        value={formatCurrency(
          marketCap,
          currency
        )}
        error={hasError}
      />

      <TopTile
        label={`${config.symbol} 24h Volume`}
        value={formatCurrency(
          volume24h,
          currency
        )}
        error={hasError}
      />

      <TopTile
        label={`${config.symbol} Dominance`}
        value={formatPercent(
          dominance
        )}
        error={hasError}
      />
    </div>
  );
}