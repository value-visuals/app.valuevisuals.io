"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

type NullableNum = number | null | undefined;

export type CoinStats = {
  priceUsd?: NullableNum;
  /** Optional percent value from older routes (e.g., 3.4 for +3.4%). */
  change24hPct?: NullableNum;
  /** Preferred: fractional daily change (e.g., 0.034 for +3.4%). */
  change24h?: NullableNum;
  marketCapUsd?: NullableNum;
  volume24hUsd?: NullableNum;
  /** Fraction (0.52 = 52%) */
  dominancePct?: NullableNum;
};

type Fetcher = () => Promise<CoinStats>;

type TileProps = {
  stats?: CoinStats;      // optional SSR data
  fetcher?: Fetcher;      // optional custom fetcher
  className?: string;
};

const formatCurrency = (n: NullableNum) =>
  n == null
    ? "—"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(n as number);

const formatPercent = (fraction: NullableNum) =>
  fraction == null ? "—" : `${((fraction as number) * 100).toFixed(2)}%`;

function Delta({ changeFraction }: { changeFraction: NullableNum }) {
  if (changeFraction == null) return <span className="text-muted-foreground">—</span>;
  const positive = changeFraction >= 0;
  return (
    <span className={`flex items-center gap-1 ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      {formatPercent(changeFraction)}
    </span>
  );
}

export default function BitcoinTopTile({ stats, fetcher, className = "" }: TileProps) {
  const [data, setData] = useState<CoinStats | null>(stats ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    if (stats) {
      setData(stats);
      return () => {
        mounted = false;
      };
    }

    const effectiveFetcher = fetcher ?? fetchBitcoinStats;

    effectiveFetcher()
      .then((d) => mounted && setData(d))
      .catch((e) => {
        console.error(e);
        if (mounted) setError("Failed to load BTC data");
      });

    return () => {
      mounted = false;
    };
  }, [stats, fetcher]);

  const tile =
    "rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors min-w-0";

  // New: prefer fractional change from backend (change24h),
  // fallback to older percent field by converting to fraction.
  const changeFraction =
    data?.change24h ??
    (data?.change24hPct != null ? (data.change24hPct as number) / 100 : null);

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      <div className={tile}>
        <div className="text-sm text-muted-foreground">BTC Price</div>
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

      <div className={tile}>
        <div className="text-sm text-muted-foreground">BTC Market Cap</div>
        <div className="mt-1 text-2xl font-semibold text-[var(--foreground)] truncate">
          {error ? "—" : formatCurrency(data?.marketCapUsd)}
        </div>
      </div>

      <div className={tile}>
        <div className="text-sm text-muted-foreground">BTC 24h Volume</div>
        <div className="mt-1 text-2xl font-semibold text-[var(--foreground)] truncate">
          {error ? "—" : formatCurrency(data?.volume24hUsd)}
        </div>
      </div>

      <div className={tile}>
        <div className="text-sm text-muted-foreground">BTC Dominance</div>
        <div className="mt-1 text-2xl font-semibold text-[var(--foreground)]">
          {error ? "—" : data?.dominancePct == null ? "—" : formatPercent(data.dominancePct)}
        </div>
      </div>
    </div>
  );
}

// Internal default fetcher – called when no fetcher prop is provided
export async function fetchBitcoinStats() {
  const res = await fetch("/api/crypto/bitcoin", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch BTC stats");
  return res.json();
}
