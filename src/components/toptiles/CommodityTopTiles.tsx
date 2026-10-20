"use client";

import { useEffect } from "react";
import { useCurrency } from "@/components/Currency";
import {
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

import {
  useMarketStore,
  type MetalAsset,
  type MetalSummary,
} from "@/stores/marketStore";

type CommodityTopTilesProps = {
  asset: MetalAsset;
  className?: string;
};

const assetConfig: Record<
  MetalAsset,
  {
    name: string;
    symbol: string;
  }
> = {
  gold: {
    name: "Gold",
    symbol: "XAU",
  },
  silver: {
    name: "Silver",
    symbol: "XAG",
  },
};

function formatPrice(value: number | null | undefined, currency: string) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: value >= 1 ? 2 : 4 }).format(value);
}

function getChangeFraction(
  summary: MetalSummary | null
) {
  if (!summary) return null;

  if (summary.changePct24h != null) {
    return summary.changePct24h / 100;
  }

  if (
    summary.change24h != null &&
    summary.price != null
  ) {
    const previousPrice =
      summary.price -
      summary.change24h;

    if (previousPrice !== 0) {
      return (
        summary.change24h /
        previousPrice
      );
    }
  }

  return null;
}

function Delta({
  summary,
}: {
  summary: MetalSummary | null;
}) {
  const changeFraction =
    getChangeFraction(summary);

  if (
    changeFraction == null ||
    Number.isNaN(changeFraction)
  ) {
    return (
      <span className="text-muted-foreground">
        —
      </span>
    );
  }

  const positive =
    changeFraction >= 0;

  return (
    <span
      className={`flex items-center gap-1 ${
        positive
          ? "text-foreground"
          : "text-red-600"
      }`}
    >
      {positive ? (
        <ArrowUpRight size={16} />
      ) : (
        <ArrowDownRight size={16} />
      )}

      {(changeFraction * 100).toFixed(2)}%
    </span>
  );
}

export default function CommodityTopTiles({
  asset,
  className = "",
}: CommodityTopTilesProps) {
  const config = assetConfig[asset];
  const { currency } = useCurrency();

  const summary = useMarketStore(
    (state) =>
      asset === "gold"
        ? state.goldSummary
        : state.silverSummary
  );

  const loading = useMarketStore(
    (state) =>
      asset === "gold"
        ? state.goldLoading
        : state.silverLoading
  );

  const error = useMarketStore(
    (state) =>
      asset === "gold"
        ? state.goldError
        : state.silverError
  );

  const fetchMetal = useMarketStore(
    (state) => state.fetchMetal
  );

  // Currency is a first-class feature. Refetch metals when the display
  // currency changes, not only on initial mount.
  useEffect(() => {
    void fetchMetal(asset, currency.toLowerCase() as "usd" | "eur" | "gbp");
  }, [asset, currency, fetchMetal]);

  const tile =
    "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors min-w-0";

  const unavailable =
    !!error || (loading && !summary);

  const change =
    summary?.change24h ?? null;

  const positive =
    change == null || change >= 0;

  return (
    <div
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}
    >
      {/* Price */}
      <div className={tile}>
        <div className="text-xs font-medium text-muted-foreground">
          {config.name} ({config.symbol}) Price · {currency}
        </div>

        <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
          {unavailable
            ? "—"
            : formatPrice(
                summary?.price, currency
              )}
        </div>

        <div className="mt-1 text-xs">
          {unavailable ? (
            <span className="text-muted-foreground">
              —
            </span>
          ) : (
            <Delta summary={summary} />
          )}
        </div>
      </div>

      {/* 24h Change */}
      <div className={tile}>
        <div className="text-xs font-medium text-muted-foreground">
          24h Change ({currency})
        </div>

        <div
          className={`mt-2 text-2xl font-semibold ${
            positive
              ? "text-foreground"
              : "text-red-500"
          }`}
        >
          {unavailable
            ? "—"
            : `${positive ? "▲" : "▼"} ${formatPrice(
                Math.abs(
                  summary?.change24h ?? 0
                ), currency
              )}`}
        </div>
      </div>

      {/* 24h High */}
      <div className={tile}>
        <div className="text-xs font-medium text-muted-foreground">
          24h High
        </div>

        <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
          {unavailable
            ? "—"
            : formatPrice(
                summary?.high24h, currency
              )}
        </div>
      </div>

      {/* 24h Low */}
      <div className={tile}>
        <div className="text-xs font-medium text-muted-foreground">
          24h Low
        </div>

        <div className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
          {unavailable
            ? "—"
            : formatPrice(
                summary?.low24h, currency
              )}
        </div>
      </div>
    </div>
  );
}