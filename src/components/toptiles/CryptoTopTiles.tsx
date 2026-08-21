"use client";

import { useEffect } from "react";
import TopTile from "./TopTile";
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
    loadingKey:
      | "bitcoinLoading"
      | "ethereumLoading"
      | "moneroLoading";
    errorKey:
      | "bitcoinError"
      | "ethereumError"
      | "moneroError";
    fetchKey:
      | "fetchBitcoinStats"
      | "fetchEthereumStats"
      | "fetchMoneroStats";
  }
> = {
  bitcoin: {
    symbol: "BTC",
    statsKey: "bitcoinStats",
    loadingKey: "bitcoinLoading",
    errorKey: "bitcoinError",
    fetchKey: "fetchBitcoinStats",
  },

  ethereum: {
    symbol: "ETH",
    statsKey: "ethereumStats",
    loadingKey: "ethereumLoading",
    errorKey: "ethereumError",
    fetchKey: "fetchEthereumStats",
  },

  monero: {
    symbol: "XMR",
    statsKey: "moneroStats",
    loadingKey: "moneroLoading",
    errorKey: "moneroError",
    fetchKey: "fetchMoneroStats",
  },
};

function formatCurrency(
  value: number | null | undefined
) {
  if (
    value == null ||
    Number.isNaN(value)
  ) {
    return "—";
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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

  return `${(value * 100).toFixed(2)}%`;
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
  const config = assetConfig[asset];

  const stats = useMarketStore(
    (state) =>
      state[config.statsKey]
  );

  const loading = useMarketStore(
    (state) =>
      state[config.loadingKey]
  );

  const error = useMarketStore(
    (state) =>
      state[config.errorKey]
  );

  const fetchStats = useMarketStore(
    (state) =>
      state[config.fetchKey]
  );

  useEffect(() => {
    if (!stats) {
      fetchStats();
    }
  }, [stats, fetchStats]);

  const changeFraction =
    getChangeFraction(stats);

  const hasError = !!error;

  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      <TopTile
        label={`${config.symbol} Price`}
        value={
          formatCurrency(
            stats?.priceUsd
          )
        }
        change={changeFraction}
        error={hasError}
      />

      <TopTile
        label={`${config.symbol} Market Cap`}
        value={
          formatCurrency(
            stats?.marketCapUsd
          )
        }
        error={hasError}
      />

      <TopTile
        label={`${config.symbol} 24h Volume`}
        value={
          formatCurrency(
            stats?.volume24hUsd
          )
        }
        error={hasError}
      />

      <TopTile
        label={`${config.symbol} Dominance`}
        value={
          formatPercent(
            stats?.dominancePct
          )
        }
        error={hasError}
      />
    </div>
  );
}