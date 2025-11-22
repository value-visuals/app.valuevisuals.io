// src/app/components/toptiles/SilverTopTile.tsx
"use client";
import useSWR from "swr";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";

type Summary = {
  metal: string;
  symbol: string; // XAG
  base: string;   // USD
  price: number;
  change24h: number | null;       // absolute $ change (today - yesterday)
  changePct24h: number | null;    // percent value (e.g., 3.4 for +3.4%)
  high24h: number | null;
  low24h: number | null;
  at: number;     // ms
  source: string;
};

// fetcher in SilverTopTile.tsx and MetalsChart.tsx
const fetcher = (url: string) =>
  fetch(url, { cache: "no-store", credentials: "include" }).then((r) => r.json());

function fmtPrice(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Number(n);

  // Always show full dollar amount (no "k" formatting)
  if (v >= 1) {
    // If it’s a whole number, show no decimals; if not, show up to 2
    return `$${v.toLocaleString(undefined, {
      minimumFractionDigits: v % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // For values under 1 (e.g., 0.532), keep up to 4 decimals
  return `$${v.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}


function fmtPct(n?: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  const s = Math.abs(n) < 1 ? n.toFixed(2) : n.toFixed(1);
  return `${s}%`;
}

function Tile({
  label,
  value,
  accent = "default",
}: {
  label: string;
  value: React.ReactNode;
  accent?: "up" | "down" | "default";
}) {
  const accentClass =
    accent === "up"
      ? "text-emerald-500"
      : accent === "down"
      ? "text-red-500"
      : "text-foreground";

  return (
    <div className="rounded-2xl bg-card text-card-foreground p-4 shadow-sm ring-1 ring-border">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={`mt-2 text-2xl font-semibold ${accentClass}`}>{value}</div>
    </div>
  );
}

// 🔹 Delta component (mirrors BitcoinTopTile behavior: arrow + percent)
function Delta({ changeFraction }: { changeFraction: number | null | undefined }) {
  if (changeFraction == null || Number.isNaN(changeFraction)) {
    return <span className="text-muted-foreground">—</span>;
  }
  const positive = changeFraction >= 0;
  const pct = `${(changeFraction * 100).toFixed(2)}%`;
  return (
    <span className={`flex items-center gap-1 ${positive ? "text-green-600" : "text-red-600"}`}>
      {positive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
      {pct}
    </span>
  );
}

export default function SilverTopTile() {
  // Calls your Next.js proxy route, which now translates metal→base/symbol
  const { data, isLoading } = useSWR<any>(
    "/api/metals/summary?metal=Silver",
    fetcher,
    { refreshInterval: 60_000 }
  );

  // 🔧 Adapt backend `{ items:[...] }` to this tile's `Summary` shape.
  const item =
    data && Array.isArray((data as any).items)
      ? (data as any).items.find(
          (it: any) =>
            String(it?.symbol || "").startsWith("XAG/") ||
            String(it?.name || "").toLowerCase() === "Silver"
        )
      : null;

  const summary: Summary | null = item
    ? {
        metal: "Silver",
        symbol: "XAG",
        base: String(item.currency || "USD"),
        price: Number(item.price ?? NaN),
        change24h: item.change ?? null,            // if your backend starts providing these
        changePct24h: item.percentChange ?? null,  // they’ll populate Delta automatically
        high24h: item.high ?? null,
        low24h: item.low ?? null,
        at: item.datetime ? Date.parse(item.datetime) : Date.now(),
        source: "API Ninjas",
      }
    : data && typeof data === "object" && "price" in data
    ? (data as Summary) // support case where proxy reshapes directly
    : null;

  // 🔸 Compute changeFraction (fraction like 0.034) for Delta line under the price:
  // 1) Prefer explicit fractional field if you ever add one in backend/proxy.
  // 2) Else convert percent → fraction.
  // 3) Else derive from absolute change if we have price and change24h.
  const changeFraction =
    // @ts-expect-error optional future field (kept for parity with BTC tile model)
    summary?.change24hFraction ??
    (summary?.changePct24h != null
      ? Number(summary.changePct24h) / 100
      : summary?.change24h != null && summary?.price != null
      ? // yesterday = price - change24h; fraction = change / yesterday
        (Number(summary.change24h) as number) /
        Math.max(1e-9, Number(summary.price) - Number(summary.change24h))
      : null);

  const up = (summary?.change24h ?? 0) >= 0;

  const priceNode = isLoading ? "…" : fmtPrice(summary?.price);
  const pctNode   = isLoading ? "…" : fmtPct(summary?.changePct24h);
  const absNode   = isLoading ? "…" : fmtPrice(summary?.change24h);
  const highNode  = isLoading ? "…" : fmtPrice(summary?.high24h);
  const lowNode   = isLoading ? "…" : fmtPrice(summary?.low24h);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* 🟡 Price tile with 24h delta line (matches BitcoinTopTile layout) */}
      <div className="rounded-2xl bg-card text-card-foreground p-4 shadow-sm ring-1 ring-border">
        <div className="text-xs font-medium text-muted-foreground">Silver (XAG) Price</div>
        <div className="mt-2 text-2xl font-semibold">{priceNode}</div>
        <div className="mt-1 text-xs">
          {isLoading ? <span className="text-muted-foreground">…</span> : <Delta changeFraction={changeFraction} />}
        </div>
      </div>

      {/* The rest of your original tiles */}
      <Tile
        label="24h Change $"
        value={(up ? "▲ " : "▼ ") + absNode}
        accent={up ? "up" : "down"}
      />
      <Tile label="24h High" value={highNode} />
      <Tile label="24h Low" value={lowNode} />
    </div>
  );
}
