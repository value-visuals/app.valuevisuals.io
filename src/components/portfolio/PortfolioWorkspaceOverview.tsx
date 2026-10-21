"use client";

import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, ChartPie, RefreshCw, Wallet } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCurrency } from "@/components/Currency";
import AssetMark from "@/components/market/AssetMark";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
import { clientApiUrl } from "@/lib/clientApiUrl";
import { formatMoney } from "@/lib/market/format";
import type { MarketAssetId, PublicMarkets } from "@/lib/market/publicMarketTypes";
import { readMetalWallets, totalTroyOunces } from "@/lib/portfolio/metals";
import type { MetalHoldings } from "@/lib/portfolio/metals";

type Summary = {
  totals: { balance: string | number };
  wallets: { address: string }[];
};
type Asset = "bitcoin" | "gold" | "silver";
type Position = { id: Asset; name: string; symbol: string; quantity: number | null; unit: string; value: number | null; share: number };
const COLOR: Record<Asset, string> = { bitcoin: "#f7931a", gold: "#e1ab32", silver: "#91a4b8" };

async function authenticatedJSON<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(url);
  if (!response.ok) throw new Error(`Portfolio data unavailable (${response.status})`);
  return response.json() as Promise<T>;
}

async function loadMetals(): Promise<MetalHoldings> {
  const [gold, silver] = await Promise.all([
    authenticatedJSON<unknown>("/api/metals/wallets?metal=gold"),
    authenticatedJSON<unknown>("/api/metals/wallets?metal=silver"),
  ]);
  return { gold: readMetalWallets(gold, "gold"), silver: readMetalWallets(silver, "silver") };
}

async function loadMarkets(url: string): Promise<PublicMarkets> {
  const response = await fetch(clientApiUrl(url), { cache: "no-store" });
  if (!response.ok) throw new Error("Market prices unavailable");
  return response.json() as Promise<PublicMarkets>;
}

function quantityValue(quantity: number | null, price: number | null): number | null {
  if (quantity === null || !Number.isFinite(quantity)) return null;
  if (quantity === 0) return 0;
  return price !== null && Number.isFinite(price) && price > 0 ? quantity * price : null;
}

function formatQuantity(position: Position): string {
  if (position.quantity === null) return "—";
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: position.id === "bitcoin" ? 8 : 5 }).format(position.quantity)} ${position.unit}`;
}

/** Authenticated summary: reuse existing wallet APIs without changing the portfolio data model. */
export default function PortfolioWorkspaceOverview() {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const { data: bitcoin, error: bitcoinError, isValidating: bitcoinRefreshing, mutate: refreshBitcoin } = useSWR(
    user ? ["mi:btc-summary", user.uid] : null,
    () => authenticatedJSON<Summary>("/api/crypto/portfolio/bitcoin?view=summary"),
    { refreshInterval: 60_000 }
  );
  const { data: metals, error: metalsError, isValidating: metalsRefreshing, mutate: refreshMetals } = useSWR(
    user ? ["mi:metal-wallets", user.uid] : null,
    loadMetals,
    { refreshInterval: 60_000 }
  );
  const { data: quotes, error: quoteError, isValidating: pricesRefreshing, mutate: refreshPrices } = useSWR(
    user ? `/api/public/markets?currency=${currency}` : null,
    loadMarkets,
    { refreshInterval: 60_000, keepPreviousData: false }
  );

  if (!user) return null;
  const currentQuotes = quotes?.currency === currency ? quotes.assets : [];
  const priceOf = (asset: MarketAssetId): number | null => currentQuotes.find(item => item.id === asset)?.price ?? null;
  const balanceRaw = Number(bitcoin?.totals?.balance);
  const balance = bitcoin && Number.isFinite(balanceRaw) && balanceRaw >= 0 ? balanceRaw / 100_000_000 : null;
  const gold = metals ? totalTroyOunces(metals.gold) : null;
  const silver = metals ? totalTroyOunces(metals.silver) : null;
  const entries = [
    { id: "bitcoin", name: "Bitcoin", symbol: "BTC", quantity: balance, unit: "BTC" },
    { id: "gold", name: "Gold", symbol: "XAU", quantity: gold, unit: "ozt" },
    { id: "silver", name: "Silver", symbol: "XAG", quantity: silver, unit: "ozt" },
  ] as const;
  const values = entries.map(item => quantityValue(item.quantity, priceOf(item.id)));
  const complete = values.every((value): value is number => value !== null);
  const total = complete ? values.reduce((sum, value) => sum + (value ?? 0), 0) : null;
  const positions: Position[] = entries.map((item, index) => ({
    ...item,
    value: values[index],
    share: total !== null && total > 0 ? ((values[index] ?? 0) / total) * 100 : 0,
  }));
  let cumulative = 0;
  const stops = positions.map(position => {
    const from = cumulative;
    cumulative += position.share;
    return `${COLOR[position.id]} ${from}% ${cumulative}%`;
  });
  const chartBackground = total !== null && total > 0
    ? `conic-gradient(${stops.join(", ")})`
    : "conic-gradient(var(--muted) 0% 100%)";
  const isRefreshing = bitcoinRefreshing || metalsRefreshing || pricesRefreshing;
  const hasError = Boolean(bitcoinError || metalsError || quoteError);
  const isLoading = !bitcoin || !metals || !quotes || quotes.currency !== currency;

  function refreshAll() {
    void refreshBitcoin();
    void refreshMetals();
    void refreshPrices();
  }

  return <section aria-label="Your portfolio overview" className="overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_1px_3px_rgba(12,20,32,0.03)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-muted"><Wallet size={17}/></span><div><p className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground">YOUR PORTFOLIO</p><h2 className="mt-0.5 text-base font-semibold sm:text-lg">Holdings overview</h2></div></div>
      <div className="flex items-center gap-2"><button type="button" title="Refresh holdings and prices" aria-label="Refresh portfolio overview" onClick={refreshAll} disabled={isRefreshing} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border transition hover:bg-muted disabled:opacity-50"><RefreshCw size={15} className={isRefreshing ? "animate-spin" : ""}/></button><Link href="/dashboard/portfolio" className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-foreground px-3.5 py-2 text-sm font-medium text-background transition hover:opacity-85">Full portfolio <ArrowRight size={15}/></Link></div>
    </div>

    <div className="grid gap-5 px-5 py-5 md:grid-cols-[minmax(0,1fr)_minmax(230px,0.75fr)] md:items-center sm:px-6 sm:py-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(200px,0.65fr)_minmax(0,1.35fr)]">
      <div className="min-w-0"><p className="text-xs font-medium text-muted-foreground">Total market value · {currency}</p><p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">{total === null ? "—" : formatMoney(total, currency)}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Bitcoin wallets and saved gold/silver holdings · priced at current market quotes.</p>
        <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3 border-t border-border pt-4"><div><p className="text-[11px] text-muted-foreground">Bitcoin wallets</p><p className="mt-1 text-sm font-semibold">{bitcoin ? (bitcoin.wallets?.length ?? 0) : "—"}</p></div><div><p className="text-[11px] text-muted-foreground">Metal wallets</p><p className="mt-1 text-sm font-semibold">{metals ? metals.gold.length + metals.silver.length : "—"}</p></div></div>
      </div>

      <div className="flex items-center justify-center md:justify-end xl:justify-center">
        <div className="relative flex h-40 w-40 shrink-0 items-center justify-center rounded-full" style={{ background: chartBackground }} role="img" aria-label={total === null ? "Portfolio allocation unavailable" : total === 0 ? "No portfolio holdings" : positions.map(item => `${item.name} ${item.share.toFixed(1)}%`).join(", ")}>
          <div className="flex h-[118px] w-[118px] flex-col items-center justify-center rounded-full bg-card"><ChartPie size={17} className="text-muted-foreground"/><span className="mt-1 text-sm font-semibold">{total === null ? "Pending" : total === 0 ? "No assets" : "Allocation"}</span><span className="mt-0.5 text-[11px] text-muted-foreground">BTC · XAU · XAG</span></div>
        </div>
      </div>

      <div className="min-w-0 space-y-2 md:col-span-2 xl:col-span-1 xl:pl-3">
        {positions.map(position => <div key={position.id} className="flex min-w-0 items-center justify-between gap-4 rounded-lg border border-border/70 px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5"><AssetMark asset={position.id} size={30}/><div className="min-w-0"><p className="truncate text-sm font-semibold">{position.name}</p><p className="text-[11px] text-muted-foreground">{formatQuantity(position)}</p></div></div>
          <div className="shrink-0 text-right"><p className="text-sm font-semibold tabular-nums">{position.value === null ? "—" : formatMoney(position.value, currency)}</p><p className="text-[11px] text-muted-foreground">{total === null ? "—" : `${position.share.toFixed(1)}%`} of total</p></div>
        </div>)}
      </div>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-5 py-3 text-xs text-muted-foreground sm:px-6"><span>{hasError ? "Some wallet or market data could not be loaded. Totals are withheld if incomplete." : isLoading ? "Loading saved wallet balances and market prices…" : "Values update every 60 seconds. Metals normalized to troy ounces."}</span><Link href="/dashboard/wallets" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">Manage wallets <ArrowRight size={12}/></Link></div>
  </section>;
}
