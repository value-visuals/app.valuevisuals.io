"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { CoinStats as BaseStats } from "./BitcoinTopTile";

type NullableNum = number | null | undefined;

export type EthStats = BaseStats & {
  // new fractional daily change (0..1). If not present, we’ll fallback to change24hPct/100.
  change24h?: NullableNum;
  // optional future field if you add it later
  stakedUsd?: NullableNum;
};

type Fetcher = () => Promise<EthStats>;

type TileProps = {
  stats?: EthStats;
  fetcher?: Fetcher;
  className?: string;
};

const tile =
  "rounded-2xl border border-border bg-[var(--surface)] p-4 shadow-sm transition-colors min-w-0";

function formatNumber(n: NullableNum) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2,
    }).format(n as number);
  } catch {
    return String(n);
  }
}

function formatCurrency(n: NullableNum) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n as number);
  } catch {
    return `$${n}`;
  }
}

function formatPercent(fraction: NullableNum) {
  if (fraction == null || Number.isNaN(fraction)) return "—";
  try {
    return new Intl.NumberFormat(undefined, {
      style: "percent",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(fraction as number);
  } catch {
    return `${((fraction as number) * 100).toFixed(2)}%`;
  }
}

function Delta({ changeFraction }: { changeFraction: NullableNum }) {
  if (changeFraction == null) {
    return <span className="text-muted-foreground">—</span>;
  }
  const positive = changeFraction >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm ${
        positive ? "text-green-600" : "text-red-600"
      }`}
    >
      {positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      {formatPercent(changeFraction)}
    </span>
  );
}

export default function EthereumTopTile({
  stats,
  fetcher = fetchEthereumStats,
  className = "",
}: TileProps) {
  const [data, setData] = useState<EthStats | undefined>(stats);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (stats) return; // if provided via props, don't refetch
    (async () => {
      try {
        const s = await fetcher();
        if (!active) return;
        setData(s);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Failed to load");
      }
    })();
    return () => {
      active = false;
    };
  }, [stats, fetcher]);

  // change24h now expected as a fraction (0..1). Fallback to change24hPct / 100 for backward compat.
  const changeFraction =
    data?.change24h ??
    (data?.change24hPct != null ? (data.change24hPct as number) / 100 : null);

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      {/* Price + daily change */}
      <div className={tile}>
        <div className="text-sm text-muted-foreground">ETH Price</div>
        <div className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
          {error ? "—" : formatCurrency(data?.priceUsd)}
        </div>
        <div className="mt-1 text-xs">
          {error ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Delta changeFraction={changeFraction} />
          )}
        </div>
      </div>

      {/* Market Cap */}
      <div className={tile}>
        <div className="text-sm text-muted-foreground">Market Cap</div>
        <div className="mt-1 text-2xl font-semibold text-[var(--foreground)] truncate">
          {error ? "—" : formatCurrency(data?.marketCapUsd)}
        </div>
      </div>

      {/* 24h Volume */}
      <div className={tile}>
        <div className="text-sm text-muted-foreground">24h Volume</div>
        <div className="mt-1 text-2xl font-semibold text-[var(--foreground)] truncate">
          {error ? "—" : formatCurrency(data?.volume24hUsd)}
        </div>
      </div>

      {/* Dominance */}
      <div className={tile}>
        <div className="text-sm text-muted-foreground">Dominance</div>
        <div className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
          {error
            ? "—"
            : data?.dominancePct == null
            ? "—"
            : formatPercent(data.dominancePct)}
        </div>
      </div>
    </div>
  );
}

// Internal default fetcher – called when no fetcher prop is provided
export async function fetchEthereumStats(): Promise<EthStats> {
  const res = await fetch("/api/crypto/ethereum", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch ETH stats");
  return res.json();
}
