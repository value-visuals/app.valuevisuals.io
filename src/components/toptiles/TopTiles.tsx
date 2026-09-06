// src/components/toptiles/Toptiles.tsx

"use client";

import Image from "next/image";
import React, {
  useEffect,
  useState,
} from "react";

import { useCurrency } from "../Currency";

import {
  useMarketStore,
  type MetalsSummary,
} from "@/stores/marketStore";

const coinColors: Record<
  "bitcoin" | "ethereum" | "gold",
  string
> = {
  bitcoin: "#F7931A",
  ethereum: "#627EEA",
  gold: "#D4AF37",
};

type TileProps = {
  label: React.ReactNode;
  value?: string;
  sub?: string;
  color?: string;
  onClick?: () => void;
  title?: string;
};

function Tile({
  label,
  value,
  sub,
  color,
  onClick,
  title,
}: TileProps) {
  const ValueTag =
    onClick ? "button" : "p";

  return (
    <div className="rounded-2xl bg-card text-card-foreground p-4 shadow-sm ring-1 ring-border min-w-0">
      <div className="text-sm text-muted-foreground">
        {label}
      </div>

      <ValueTag
        onClick={onClick}
        title={title}
        className={[
          "mt-2 text-2xl font-semibold text-left",
          "block w-full overflow-hidden text-ellipsis whitespace-nowrap",
          onClick
            ? "cursor-pointer hover:underline decoration-dotted focus:outline-none"
            : "",
        ].join(" ")}
        style={{
          color:
            color ??
            "var(--foreground)",
        }}
        aria-label={
          title || value
        }
      >
        {value ?? "—"}
      </ValueTag>

      {sub && (
        <p className="mt-1 text-xs text-muted-foreground">
          {sub}
        </p>
      )}
    </div>
  );
}

function getGoldPrice(
  data: MetalsSummary | null
): number | undefined {
  if (!data) {
    return undefined;
  }

  if (Array.isArray(data.items)) {
    const item =
      data.items.find(
        (x) =>
          String(
            x?.symbol ?? ""
          ).startsWith("XAU/") ||
          String(
            x?.name ?? ""
          ).toLowerCase() === "gold"
      );

    const price =
      item?.price;

    if (
      typeof price === "number"
    ) {
      return price;
    }

    if (price != null) {
      return Number(price);
    }
  }

  if (
    typeof data === "object" &&
    data !== null &&
    "price" in data
  ) {
    const price =
      data.price;

    if (
      typeof price === "number"
    ) {
      return price;
    }

    if (price != null) {
      return Number(price);
    }
  }

  return undefined;
}

export default function TopTiles() {
  const { currency } =
    useCurrency();

  const cryptoSummary =
    useMarketStore(
      (state) =>
        state.cryptoSummary
    );

  const metalsSummary =
    useMarketStore(
      (state) =>
        state.metalsSummary
    );

  const cryptoError =
    useMarketStore(
      (state) =>
        state.cryptoError
    );

  const metalsError =
    useMarketStore(
      (state) =>
        state.metalsError
    );

  const fetchMarketData =
    useMarketStore(
      (state) =>
        state.fetchMarketData
    );

  const [
    showFullCap,
    setShowFullCap,
  ] = useState(false);

  const curKey =
    currency.toLowerCase();

  /*
   * Currency remains owned by the existing
   * Currency provider. Whenever it changes,
   * synchronize the market data in Zustand.
   */
  useEffect(() => {
    void fetchMarketData(
      curKey as
        | "usd"
        | "eur"
        | "gbp"
    );
  }, [
    curKey,
    fetchMarketData,
  ]);

  const fmt = (
  n?: number | null
) =>
  typeof n === "number"
    ? new Intl.NumberFormat(
        undefined,
        {
          style: "currency",
          currency,
        }
      ).format(n)
    : undefined;

const capFullFmt = (
  n?: number | null
) =>
  typeof n === "number"
    ? new Intl.NumberFormat(
        undefined,
        {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }
      ).format(n)
    : undefined;

  /*
   * Truncating compact currency formatter
   * (floors to 1 decimal).
   */
  function compactTruncCurrency(
  n?: number | null
): string | undefined {
  if (
    typeof n !== "number"
  ) {
    return undefined;
  }

  const abs =
    Math.abs(n);

  const units: Array<{
    div: number;
    suffix: string;
  }> = [
    {
      div: 1e12,
      suffix: "T",
    },
    {
      div: 1e9,
      suffix: "B",
    },
    {
      div: 1e6,
      suffix: "M",
    },
    {
      div: 1e3,
      suffix: "K",
    },
  ];

  for (
    const {
      div,
      suffix,
    } of units
  ) {
    if (abs >= div) {
      const raw =
        n / div;

      const floored =
        Math.floor(
          raw * 10
        ) / 10;

      const formatted =
        new Intl.NumberFormat(
          undefined,
          {
            style: "currency",
            currency,
            minimumFractionDigits:
              floored % 1 === 0
                ? 0
                : 1,
            maximumFractionDigits: 1,
          }
        ).format(floored);

      return `${formatted}${suffix}`;
    }
  }

  return new Intl.NumberFormat(
    undefined,
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }
  ).format(n);
}

  const goldPrice =
    getGoldPrice(
      metalsSummary
    );

  const rawCap =
    cryptoSummary
      ?.global_market_cap?.[
      curKey
    ] as number | undefined;

  const capCompact =
    compactTruncCurrency(
      rawCap
    );

  const capFull =
    capFullFmt(rawCap);

  const bitcoinPrice =
    cryptoSummary
      ?.bitcoin?.[curKey];

  const ethereumPrice =
    cryptoSummary
      ?.ethereum?.[curKey];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Tile
        label={
          <span className="flex items-center gap-2">
            <Image
              src="/bitcoin.svg"
              alt="Bitcoin"
              width={20}
              height={20}
            />

            Bitcoin
          </span>
        }
        value={fmt(
          bitcoinPrice
        )}
        sub={
          cryptoError
            ? "Error loading"
            : "Updated live"
        }
        color={
          coinColors.bitcoin
        }
      />

      <Tile
        label={
          <span className="flex items-center gap-2">
            <Image
              src="/ethereum.png"
              alt="Ethereum"
              width={20}
              height={20}
            />

            Ethereum
          </span>
        }
        value={fmt(
          ethereumPrice
        )}
        sub={
          cryptoError
            ? "Error loading"
            : "Updated live"
        }
        color={
          coinColors.ethereum
        }
      />

      <Tile
        label="Gold"
        value={fmt(
          goldPrice
        )}
        sub={
          metalsError
            ? "Error loading"
            : "Updated live"
        }
        color={
          coinColors.gold
        }
      />

      <Tile
        label="Crypto Market Cap"
        value={
          showFullCap
            ? capFull
            : capCompact
        }
        title={capFull}
        onClick={() =>
          setShowFullCap(
            (value) =>
              !value
          )
        }
        sub={
          cryptoError
            ? "Error loading"
            : "From CoinGecko"
        }
      />
    </div>
  );
}