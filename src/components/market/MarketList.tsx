"use client";

import React from "react";
import Image from "next/image";

import {
  useMarketStore,
  type CryptoAssetSummary,
  type CryptoAssetStats,
  type MetalsSummaryItem,
} from "@/stores/marketStore";

/* =========================================================
 * Types
 * ======================================================= */

type MarketRow = {
  id: string;
  name: string;
  symbol: string;
  type: "crypto" | "metal";

  logo?: string;
  href?: string;

  price: number | null;
  change24hPct: number | null;
  change7dPct: number | null;
  marketCap: number | null;
  volume24h: number | null;
  dominancePct: number | null;
};


/* =========================================================
 * Helpers
 * ======================================================= */

function toNumber(value: unknown): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getCurrencyValue(
  asset: CryptoAssetSummary | undefined,
  currency: string
): number | null {
  if (!asset) {
    return null;
  }

  return toNumber(
    asset[currency] ??
      asset[currency.toLowerCase()] ??
      asset[currency.toUpperCase()]
  );
}

/* =========================================================
 * Crypto
 * ======================================================= */

function createCryptoRow(
  name: "bitcoin" | "ethereum" | "monero",
  summary: ReturnType<
    typeof useMarketStore.getState
  >["cryptoSummary"],
  currency: string
): MarketRow | null {
  if (!summary) {
    return null;
  }

  const stats =
    summary[
      `${name}_stats`
    ] as CryptoAssetStats | undefined;

  const asset =
    summary[name] as
      | CryptoAssetSummary
      | undefined;

  const metadata = {
    bitcoin: {
      name: "Bitcoin",
      symbol: "BTC",
      logo: "/bitcoin.svg",
    },

    ethereum: {
      name: "Ethereum",
      symbol: "ETH",
      logo: "/ethereum.png",
    },

    monero: {
      name: "Monero",
      symbol: "XMR",
      logo: "/monero.svg",
    },
  }[name];

  /*
   * Prefer the normalized stats price.
   *
   * Fall back to the currency-specific
   * summary value when necessary.
   */
  const price =
    toNumber(stats?.price) ??
    getCurrencyValue(
      asset,
      currency
    );

  return {
    id: name,

    name: metadata.name,

    symbol: metadata.symbol,

    type: "crypto",

    logo: metadata.logo,

    price,

    change24hPct:
      toNumber(
        stats?.change24hPct
      ),

    change7dPct:
      toNumber(
        stats?.change7dPct
      ),

    marketCap:
      toNumber(
        stats?.marketCap
      ),

    volume24h:
      toNumber(
        stats?.volume24h
      ),

    dominancePct:
      toNumber(
        stats?.dominancePct
      ),
  };
}

/* =========================================================
 * Metals
 * ======================================================= */

function createMetalRow(
  asset: "gold" | "silver",
  items: MetalsSummaryItem[] | undefined
): MarketRow | null {
  if (!items?.length) {
    return null;
  }

  const symbol =
    asset === "gold"
      ? "XAU"
      : "XAG";

  const item = items.find(
    (entry) => {
      const entrySymbol =
        String(
          entry.symbol ?? ""
        ).toUpperCase();

      const entryName =
        String(
          entry.name ?? ""
        ).toLowerCase();

      return (
        entrySymbol === symbol ||
        entrySymbol.startsWith(
          `${symbol}/`
        ) ||
        entryName === asset
      );
    }
  );

  if (!item) {
    return null;
  }

  return {
    id: asset,

    name:
      asset === "gold"
        ? "Gold"
        : "Silver",

    symbol,

    type: "metal",

    price: toNumber(
      item.price
    ),

    change24hPct:
      toNumber(
        item.percentChange
      ),

    /*
     * Metals do not currently expose
     * these crypto-style metrics.
     */
    change7dPct: null,

    marketCap: null,

    volume24h: null,

    dominancePct: null,
  };
}

/* =========================================================
 * Formatting
 * ======================================================= */

function formatPrice(
  value: number | null,
  currency: string
): string {
  if (value === null) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency:
          currency.toUpperCase(),

        minimumFractionDigits:
          value >= 1 ? 2 : 4,

        maximumFractionDigits:
          value >= 1 ? 2 : 6,
      }
    ).format(value);
  } catch {
    return value.toLocaleString();
  }
}

function formatCompactCurrency(
  value: number | null,
  currency: string
): string {
  if (value === null) {
    return "—";
  }

  try {
    return new Intl.NumberFormat(
      undefined,
      {
        style: "currency",
        currency:
          currency.toUpperCase(),

        notation: "compact",

        maximumFractionDigits: 2,
      }
    ).format(value);
  } catch {
    return value.toLocaleString();
  }
}

function formatPercent(
  value: number | null
): string {
  if (value === null) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

/* =========================================================
 * Loading
 * ======================================================= */

function LoadingRows() {
  return (
    <div className="divide-y divide-border/50">
      {Array.from({
        length: 5,
      }).map((_, index) => (
        <div
          key={index}
          className="
            grid
            grid-cols-12
            items-center
            gap-4
            px-4
            py-4
            sm:px-5
          "
        >
          <div className="col-span-5 flex items-center gap-3">
            <div className="size-8 animate-pulse rounded-full bg-muted" />

            <div className="space-y-1.5">
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />

              <div className="h-2.5 w-10 animate-pulse rounded bg-muted" />
            </div>
          </div>

          <div className="col-span-3 flex justify-end">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>

          <div className="col-span-2 flex justify-end">
            <div className="h-3 w-14 animate-pulse rounded bg-muted" />
          </div>

          <div className="col-span-2 flex justify-end">
            <div className="h-3 w-20 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* =========================================================
 * Asset icon
 * ======================================================= */

function AssetIcon({
  asset,
}: {
  asset: MarketRow;
}) {
  /*
   * Gold and silver use the same
   * colored-dot treatment as the
   * existing metals UI.
   */
  if (asset.type === "metal") {
    const isGold =
      asset.symbol === "XAU";

    return (
      <div
        className={`
          flex
          size-9
          shrink-0
          items-center
          justify-center
          rounded-full
          ring-1
          ring-border/60
          ${
            isGold
              ? "bg-amber-400/20 text-amber-500"
              : "bg-slate-400/20 text-slate-400"
          }
        `}
      >
        <span
          className={`
            size-3.5
            rounded-full
            ${
              isGold
                ? "bg-amber-400"
                : "bg-slate-400"
            }
          `}
        />
      </div>
    );
  }

  if (!asset.logo) {
    return (
      <div
        className="
          flex
          size-9
          shrink-0
          items-center
          justify-center
          rounded-full
          bg-muted
          text-sm
          font-semibold
        "
      >
        {asset.symbol.charAt(0)}
      </div>
    );
  }

  return (
    <div
      className="
        flex
        size-9
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
        src={asset.logo}
        alt=""
        width={22}
        height={22}
        className="size-[22px] object-contain"
      />
    </div>
  );
}

/* =========================================================
 * Main component
 * ======================================================= */

export default function MarketList({
  className = "",
}: {
  className?: string;
}) {
  const currency =
    useMarketStore(
      (state) => state.currency
    );

  const cryptoSummary =
    useMarketStore(
      (state) => state.cryptoSummary
    );

  const metalsSummary =
    useMarketStore(
      (state) => state.metalsSummary
    );

  const cryptoLoading =
    useMarketStore(
      (state) => state.cryptoLoading
    );

  const metalsLoading =
    useMarketStore(
      (state) => state.metalsLoading
    );

  const cryptoError =
    useMarketStore(
      (state) => state.cryptoError
    );

  const metalsError =
    useMarketStore(
      (state) => state.metalsError
    );

  const assets =
    React.useMemo(() => {
      const rows: MarketRow[] =
        [];

      const bitcoin =
        createCryptoRow(
          "bitcoin",
          cryptoSummary,
          currency
        );

      const ethereum =
        createCryptoRow(
          "ethereum",
          cryptoSummary,
          currency
        );

      const monero =
        createCryptoRow(
          "monero",
          cryptoSummary,
          currency
        );

      const gold =
        createMetalRow(
          "gold",
          metalsSummary?.items
        );

      const silver =
        createMetalRow(
          "silver",
          metalsSummary?.items
        );

      if (bitcoin) {
        rows.push(bitcoin);
      }

      if (ethereum) {
        rows.push(ethereum);
      }

      if (monero) {
        rows.push(monero);
      }

      if (gold) {
        rows.push(gold);
      }

      if (silver) {
        rows.push(silver);
      }

      return rows;
    }, [
      cryptoSummary,
      metalsSummary,
      currency,
    ]);

  const loading =
    cryptoLoading ||
    metalsLoading;

  if (
    loading &&
    assets.length === 0
  ) {
    return (
      <section
        className={`
          overflow-hidden
          rounded-2xl
          border
          border-border/70
          bg-card
          shadow-sm
          ${className}
        `}
      >
        <Header />

        <LoadingRows />
      </section>
    );
  }

  if (
    assets.length === 0 &&
    (cryptoError ||
      metalsError)
  ) {
    return (
      <section
        className={`
          rounded-2xl
          border
          border-border/70
          bg-card
          p-6
          shadow-sm
          ${className}
        `}
      >
        <div className="text-sm font-semibold">
          Unable to load markets
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          {cryptoError ||
            metalsError}
        </div>
      </section>
    );
  }

  return (
    <section
      className={`
        overflow-hidden
        rounded-2xl
        border
        border-border/70
        bg-card
        text-card-foreground
        shadow-sm
        ${className}
      `}
    >
      <Header />

      {/* Desktop table header */}

      <div
        className="
          hidden
          grid-cols-12
          items-center
          gap-4
          border-b
          border-border/50
          bg-muted/20
          px-4
          py-2.5
          text-[10px]
          font-semibold
          uppercase
          tracking-wider
          text-muted-foreground
          sm:grid
          sm:px-5
        "
      >
        <div className="col-span-3">
          Asset
        </div>

        <div className="col-span-2 text-right">
          Price
        </div>

        <div className="col-span-1 text-right">
          24h
        </div>

        <div className="col-span-1 text-right">
          7d
        </div>

        <div className="col-span-2 text-right">
          24h Volume
        </div>

        <div className="col-span-2 text-right">
          Market Cap
        </div>

        <div className="col-span-1 text-right">
          Dominance
        </div>
      </div>

      <div className="divide-y divide-border/50">
        {assets.map(
          (asset, index) => (
            <MarketRowItem
              key={asset.id}
              asset={asset}
              index={index}
              currency={currency}
            />
          )
        )}
      </div>

      {(cryptoError ||
        metalsError) && (
        <div className="border-t border-border/50 px-5 py-2.5 text-[10px] text-muted-foreground">
          Some market data could not be refreshed.
        </div>
      )}
    </section>
  );
}

/* =========================================================
 * Header
 * ======================================================= */

function Header() {
  return (
    <div
      className="
        flex
        items-center
        justify-between
        border-b
        border-border/60
        px-4
        py-4
        sm:px-5
      "
    >
      <div>
        <h2 className="text-base font-semibold tracking-tight">
          Markets
        </h2>

        <p className="mt-0.5 text-xs text-muted-foreground">
          Crypto and precious metals
        </p>
      </div>

      <div
        className="
          flex
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
        <span className="size-1.5 rounded-full bg-emerald-500" />

        Live
      </div>
    </div>
  );
}

/* =========================================================
 * Row
 * ======================================================= */

function MarketRowItem({
  asset,
  index,
  currency,
}: {
  asset: MarketRow;
  index: number;
  currency: string;
}) {
  const positive24h =
    (asset.change24hPct ?? 0) >=
    0;

  const positive7d =
    (asset.change7dPct ?? 0) >=
    0;

  return (
    <div
      className="
        grid
        grid-cols-1
        gap-3
        px-4
        py-4
        transition-colors
        hover:bg-muted/30
        sm:grid-cols-12
        sm:items-center
        sm:gap-4
        sm:px-5
      "
    >
      {/* Asset */}

      <div className="flex min-w-0 items-center gap-3 sm:col-span-3">
        <span
          className="
            hidden
            w-5
            shrink-0
            text-xs
            tabular-nums
            text-muted-foreground/60
            sm:block
          "
        >
          {index + 1}
        </span>

        <AssetIcon asset={asset} />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">
              {asset.name}
            </span>

            <span className="text-[10px] font-medium uppercase text-muted-foreground">
              {asset.symbol}
            </span>
          </div>

          <div className="mt-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {asset.type}
          </div>
        </div>
      </div>

      {/* Price */}

      <div className="flex items-center justify-between sm:col-span-2 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:hidden">
          Price
        </span>

        <span className="text-sm font-semibold tabular-nums">
          {formatPrice(
            asset.price,
            currency
          )}
        </span>
      </div>

      {/* 24h */}

      <div className="flex items-center justify-between sm:col-span-1 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:hidden">
          24h
        </span>

        <span
          className={`text-sm font-semibold tabular-nums ${
            positive24h
              ? "text-emerald-500"
              : "text-red-500"
          }`}
        >
          {formatPercent(
            asset.change24hPct
          )}
        </span>
      </div>

      {/* 7d */}

      <div className="flex items-center justify-between sm:col-span-1 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:hidden">
          7d
        </span>

        {asset.type ===
        "crypto" ? (
          <span
            className={`text-sm font-semibold tabular-nums ${
              positive7d
                ? "text-emerald-500"
                : "text-red-500"
            }`}
          >
            {formatPercent(
              asset.change7dPct
            )}
          </span>
        ) : (
          <span className="text-sm font-semibold tabular-nums text-muted-foreground">
            —
          </span>
        )}
      </div>

      {/* 24h Volume */}

      <div className="flex items-center justify-between sm:col-span-2 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:hidden">
          24h Volume
        </span>

        {asset.type ===
        "crypto" ? (
          <span className="text-sm font-medium tabular-nums">
            {formatCompactCurrency(
              asset.volume24h,
              currency
            )}
          </span>
        ) : (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            —
          </span>
        )}
      </div>

      {/* Market Cap */}

      <div className="flex items-center justify-between sm:col-span-2 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:hidden">
          Market Cap
        </span>

        {asset.type ===
        "crypto" ? (
          <span className="text-sm font-medium tabular-nums">
            {formatCompactCurrency(
              asset.marketCap,
              currency
            )}
          </span>
        ) : (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            —
          </span>
        )}
      </div>

      {/* Dominance */}

      <div className="flex items-center justify-between sm:col-span-1 sm:block sm:text-right">
        <span className="text-xs text-muted-foreground sm:hidden">
          Dominance
        </span>

        {asset.type ===
        "crypto" ? (
          <span className="text-sm font-medium tabular-nums">
            {formatPercent(
              asset.dominancePct
            )}
          </span>
        ) : (
          <span className="text-sm font-medium tabular-nums text-muted-foreground">
            —
          </span>
        )}
      </div>
    </div>
  );
}
