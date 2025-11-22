// src/components/TopTiles.tsx
"use client";
import useSWR from "swr";
import Image from "next/image";
import React, { useMemo, useState } from "react";
import { useCurrency } from "../Currency";

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store", credentials: "include" }).then((r) => r.json());

const coinColors: Record<"bitcoin" | "ethereum" | "gold", string> = {
  bitcoin: "#F7931A",
  ethereum: "#627EEA",
  gold: "#D4AF37",
};

function Tile({
  label,
  value,
  sub,
  color,
  onClick,
  title,
}: {
  label: React.ReactNode;
  value?: string;
  sub?: string;
  color?: string;
  onClick?: () => void;
  title?: string;
}) {
  const ValueTag = onClick ? "button" : "p";
  return (
    <div className="rounded-2xl bg-card text-card-foreground p-4 shadow-sm ring-1 ring-border min-w-0">
      <div className="text-sm text-muted-foreground">{label}</div>

      <ValueTag
        onClick={onClick}
        title={title}
        className={[
          "mt-2 text-2xl font-semibold text-left", // 👈 added text-left
          "block w-full overflow-hidden text-ellipsis whitespace-nowrap", // ensures truncation
          onClick ? "cursor-pointer hover:underline decoration-dotted focus:outline-none" : "",
        ].join(" ")}
        style={{ color: color ?? "var(--foreground)" }}
        aria-label={title || value}
      >
        {value ?? "—"}
      </ValueTag>

      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export default function TopTiles() {
  const { currency } = useCurrency();
  const curKey = currency.toLowerCase() as "usd" | "eur" | "gbp";

  const cryptoUrl = useMemo(() => `/api/crypto/summary?currency=${currency}`, [currency]);
  const { data, error } = useSWR(cryptoUrl, fetcher, { refreshInterval: 60_000 });

  const goldUrl = useMemo(
    () => `/api/metals/summary?base=gold&currency=${currency}`,
    [currency]
  );
  const { data: goldData, error: goldError } = useSWR(goldUrl, fetcher, { refreshInterval: 60_000 });

  function getGoldPrice(d: any): number | undefined {
    if (!d) return undefined;
    if (Array.isArray(d.items)) {
      const it = d.items.find(
        (x: any) =>
          String(x?.symbol || "").startsWith("XAU/") ||
          String(x?.name || "").toLowerCase() === "gold"
      );
      const p = it?.price;
      return typeof p === "number" ? p : p != null ? Number(p) : undefined;
    }
    if (typeof d === "object" && d !== null && "price" in d) {
      const p = (d as any).price;
      return typeof p === "number" ? p : p != null ? Number(p) : undefined;
    }
    return undefined;
  }

  const fmt = (n?: number) =>
    typeof n === "number"
      ? new Intl.NumberFormat(undefined, { style: "currency", currency }).format(n)
      : undefined;

  const capFullFmt = (n?: number) =>
    typeof n === "number"
      ? new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          maximumFractionDigits: 0,
        }).format(n)
      : undefined;

  // Truncating compact currency formatter (floors to 1 decimal)
  function compactTruncCurrency(n?: number): string | undefined {
    if (typeof n !== "number") return undefined;

    const abs = Math.abs(n);
    const units: Array<{ div: number; suffix: string }> = [
      { div: 1e12, suffix: "T" },
      { div: 1e9, suffix: "B" },
      { div: 1e6, suffix: "M" },
      { div: 1e3, suffix: "K" },
    ];

    for (const { div, suffix } of units) {
      if (abs >= div) {
        const raw = n / div;
        const floored = Math.floor(raw * 10) / 10; // floor to 1 decimal
        const formatted = new Intl.NumberFormat(undefined, {
          style: "currency",
          currency,
          minimumFractionDigits: floored % 1 === 0 ? 0 : 1,
          maximumFractionDigits: 1,
        }).format(floored);
        return `${formatted}${suffix}`;
      }
    }

    // < 1000: show normal currency with up to 2 decimals
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  }

  const goldPrice = getGoldPrice(goldData);

  // Toggle for market cap display
  const [showFullCap, setShowFullCap] = useState(false);
  const rawCap = data?.global_market_cap?.[curKey] as number | undefined;
  const capCompact = compactTruncCurrency(rawCap);
  const capFull = capFullFmt(rawCap); // long string, will truncate visually but show full on hover

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Tile
        label={
          <span className="flex items-center gap-2">
            <Image src="/bitcoin.svg" alt="Bitcoin (BTC)" width={20} height={20} />
            Bitcoin (BTC)
          </span>
        }
        value={fmt(data?.bitcoin?.[curKey])}
        sub={error ? "Error loading" : "Updated live"}
        color={coinColors.bitcoin}
      />
      <Tile
        label={
          <span className="flex items-center gap-2">
            <Image src="/ethereum.png" alt="Ethereum (ETH)" width={20} height={20} />
            Ethereum (ETH)
          </span>
        }
        value={fmt(data?.ethereum?.[curKey])}
        sub={error ? "Error loading" : "Updated live"}
        color={coinColors.ethereum}
      />
      <Tile
        label="Gold (XAU)"
        value={fmt(goldPrice)}
        sub={goldError ? "Error loading" : "Updated live"}
        color={coinColors.gold}
      />
      <Tile
        label="Crypto Market Cap"
        value={showFullCap ? capFull : capCompact}
        title={capFull} // full value on hover
        onClick={() => setShowFullCap((s) => !s)}
        sub={error ? "Error loading" : "From CoinGecko"}
      />
    </div>
  );
}
