"use client";

import Link from "next/link";
import useSWR from "swr";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CircleHelp,
  Coins,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useCurrency } from "@/components/Currency";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
import { clientApiUrl } from "@/lib/clientApiUrl";
import { formatChange, formatMoney } from "@/lib/market/format";
import type { MarketAsset, PublicMarkets } from "@/lib/market/publicMarketTypes";
import AssetMark from "@/components/market/AssetMark";
import PortfolioChart from "@/components/charts/PortfolioChart";
import { readMetalWallets, totalTroyOunces } from "@/lib/portfolio/metals";
import type { MetalHoldings, MetalWallet } from "@/lib/portfolio/metals";

type Integerish = string | number;
type WalletStat = {
  address: string;
  totalReceived: Integerish;
  totalSent: Integerish;
  balance: Integerish;
  pendingDelta: Integerish;
  txCount: number;
};
type SummaryResponse = {
  totals: {
    balance: Integerish;
    totalReceived: Integerish;
    totalSent: Integerish;
    pendingDelta: Integerish;
  };
  wallets: WalletStat[];
};
type CoinStats = { priceUsd?: number | null; change24h?: number | null; change24hPct?: number | null };
type ChartPoint = { t: number | string; flow: Integerish; cum: Integerish };
type ChartResponse = { range: string; points: ChartPoint[]; note?: string };

type PortfolioSnapshot = {
  summary: SummaryResponse;
  chart: ChartResponse;
  btcStats: CoinStats | null;
};

const EMPTY_TOTALS = { balance: "0", totalReceived: "0", totalSent: "0", pendingDelta: "0" };

async function privateJSON<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(url);
  if (!response.ok) throw new Error(`Portfolio service returned ${response.status}`);
  return response.json() as Promise<T>;
}

async function getPortfolio(): Promise<PortfolioSnapshot> {
  // Keep the currently working API contract and user-specific SWR cache key.
  const [summary, chart, btcStats] = await Promise.all([
    privateJSON<SummaryResponse>("/api/crypto/portfolio/bitcoin?view=summary"),
    privateJSON<ChartResponse>("/api/crypto/portfolio/bitcoin?view=chart&range=30d"),
    privateJSON<CoinStats>("/api/crypto/bitcoin").catch(() => null),
  ]);
  return { summary, chart, btcStats };
}

async function getMetals(): Promise<MetalHoldings> {
  // Reuse the same authenticated endpoints as the existing Wallets page.
  const [goldResponse, silverResponse] = await Promise.all([
    privateJSON<unknown>("/api/metals/wallets?metal=gold"),
    privateJSON<unknown>("/api/metals/wallets?metal=silver"),
  ]);
  return {
    gold: readMetalWallets(goldResponse, "gold"),
    silver: readMetalWallets(silverResponse, "silver"),
  };
}

async function getPublicMarkets(url: string): Promise<PublicMarkets> {
  const response = await fetch(clientApiUrl(url), { cache: "no-store" });
  if (!response.ok) throw new Error("Public market quotes unavailable");
  return response.json() as Promise<PublicMarkets>;
}

function toNumber(value: Integerish | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBtc(value: Integerish): number { return toNumber(value) / 100_000_000; }
function formatBtc(value: Integerish): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(asBtc(value))} BTC`;
}
function formatSats(value: Integerish): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(toNumber(value))} sats`;
}
function formatUtcDate(value: number | string): string {
  const numberValue = Number(value);
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : Number.isFinite(numberValue)
      ? new Date(numberValue > 1e12 ? numberValue : numberValue * 1000)
      : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}
function timestamp(value: number | string): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : Date.parse(String(value)) / 1000;
}
function percentChange(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return <span className="text-muted-foreground">—</span>;
  return <span className={`inline-flex items-center gap-1 font-medium ${value >= 0 ? "text-foreground" : "text-red-500"}`}>
    {value >= 0 ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}{formatChange(value)}
  </span>;
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`min-w-0 overflow-hidden rounded-[18px] border border-border bg-card shadow-[0_1px_3px_rgba(12,20,32,0.03)] ${className}`}>{children}</section>;
}

function Metric({ label, value, sub, icon }: { label: string; value: React.ReactNode; sub: string; icon: React.ReactNode }) {
  return <Card className="p-4 sm:p-5">
    <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground"><span>{label}</span><span className="opacity-70">{icon}</span></div>
    <div className="mt-3 truncate text-xl font-semibold tracking-tight sm:text-2xl">{value}</div>
    <p className="mt-1 text-[11px] leading-snug text-muted-foreground sm:text-xs">{sub}</p>
  </Card>;
}

type PositionId = "bitcoin" | "gold" | "silver";
type PortfolioPosition = {
  id: PositionId;
  quantity: number | null;
  price: number | null;
  value: number | null;
  wallets: MetalWallet[];
};

const COLORS: Record<PositionId, string> = {
  bitcoin: "#f7931a",
  gold: "#e1ab32",
  silver: "#91a4b8",
};

function formatOzt(amount: number): string {
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 5 }).format(amount)} ozt`;
}

function PortfolioAllocation({ positions, totalValue, currency }: { positions: PortfolioPosition[]; totalValue: number | null; currency: string }) {
  const valued = totalValue !== null;
  const heldCount = positions.filter(position => position.quantity !== null && position.quantity > 0).length;
  const shares = positions.map(position => ({
    ...position,
    share: valued && totalValue > 0 ? ((position.value ?? 0) / totalValue) * 100 : 0,
  }));
  let previous = 0;
  const gradientStops = shares.map(position => {
    const start = previous;
    previous += position.share;
    return `${COLORS[position.id]} ${start}% ${previous}%`;
  });
  const gradient = valued && totalValue > 0
    ? `conic-gradient(${gradientStops.join(", ")})`
    : "conic-gradient(var(--muted) 0% 100%)";

  return <Card className="flex flex-col p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-[10px] font-semibold tracking-[0.13em] text-muted-foreground">ASSET ALLOCATION</div><h2 className="mt-2 text-lg font-semibold">Holdings breakdown</h2></div>
      <Coins size={17} className="text-muted-foreground" aria-hidden="true" />
    </div>
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-7 sm:flex-row lg:flex-col xl:flex-row">
      <div className="relative flex h-44 w-44 shrink-0 items-center justify-center rounded-full" style={{ background: gradient }} role="img" aria-label={valued && totalValue > 0 ? "Allocation of Bitcoin, gold and silver by market value" : "Portfolio allocation unavailable"}>
        <div className="flex h-[132px] w-[132px] flex-col items-center justify-center rounded-full bg-card text-center">
          <span className="text-2xl font-semibold tracking-tight">{valued ? heldCount : "—"}</span>
          <span className="mt-1 text-[11px] text-muted-foreground">{valued ? (heldCount === 1 ? "Asset held" : "Assets held") : "Valuation pending"}</span>
        </div>
      </div>
      <div className="w-full min-w-0 space-y-4 text-sm">
        {shares.map(position => <div key={position.id} className="flex items-start justify-between gap-3">
          <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: COLORS[position.id] }}/>{position.id === "bitcoin" ? "Bitcoin" : position.id === "gold" ? "Gold" : "Silver"}</span>
          <span className="text-right"><span className="block font-semibold">{position.value === null ? "—" : formatMoney(position.value, currency)}</span><span className="text-xs text-muted-foreground">{valued ? `${position.share.toFixed(1)}%` : "—"}</span></span>
        </div>)}
      </div>
    </div>
    <div className="border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">Allocation includes saved Bitcoin, gold and silver holdings, valued in {currency}. Metals are converted to troy ounces. Missing quotes or wallet data prevent an incomplete allocation from being displayed.</div>
  </Card>;
}

function AssetHoldings({ positions, currency, quotePending, metalsLoading, metalsError }: { positions: PortfolioPosition[]; currency: string; quotePending: boolean; metalsLoading: boolean; metalsError: boolean }) {
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-4 sm:px-6"><div><h2 className="text-lg font-semibold">Your assets</h2><p className="mt-1 text-xs text-muted-foreground">Connected wallets, normalized quantities and current market values</p></div><span className="rounded-md bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">BTC · XAU · XAG</span></div>
    <div className="divide-y divide-border">
      {positions.map(position => {
        const bitcoin = position.id === "bitcoin";
        const meta = bitcoin ? { name: "Bitcoin", symbol: "BTC" } : position.id === "gold" ? { name: "Gold", symbol: "XAU" } : { name: "Silver", symbol: "XAG" };
        const holdingsLabel = position.quantity === null
          ? (metalsError ? "Unavailable" : metalsLoading ? "Loading…" : "—")
          : bitcoin ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(position.quantity)} BTC` : formatOzt(position.quantity);
        return <div key={position.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(0,1.35fr)_minmax(0,.8fr)_minmax(0,.8fr)_minmax(0,.8fr)] sm:px-6">
          <div className="flex min-w-0 items-center gap-3"><AssetMark asset={position.id} size={39}/><div className="min-w-0"><div className="font-semibold">{meta.name}</div><div className="text-xs text-muted-foreground">{meta.symbol} · {bitcoin ? "Wallet tracked" : position.quantity === null ? "Wallet status pending" : `${position.wallets.length} saved ${position.wallets.length === 1 ? "wallet" : "wallets"}`}</div></div></div>
          <div className="text-right sm:text-left"><div className="text-xs text-muted-foreground sm:hidden">Market price</div><div className="text-sm font-semibold">{quotePending && position.price == null ? "Loading…" : formatMoney(position.price, currency)}</div><div className="text-xs text-muted-foreground">{bitcoin ? "per BTC" : "per troy oz"}</div></div>
          <div className="min-w-0"><div className="text-[11px] text-muted-foreground">Holdings</div><div className="mt-0.5 text-sm font-medium">{holdingsLabel}</div></div>
          <div className="text-right"><div className="text-[11px] text-muted-foreground">Market value</div><div className="mt-0.5 text-sm font-semibold">{position.value === null ? "—" : formatMoney(position.value, currency)}</div></div>
          {!bitcoin && position.wallets.length > 0 && <div className="col-span-full flex flex-wrap gap-2 border-t border-border/60 pt-3 text-xs text-muted-foreground">
            {position.wallets.map((wallet, index) => <span key={`${wallet.id}-${index}`} className="rounded-md bg-muted/60 px-2.5 py-1.5"><span className="font-medium text-foreground">{wallet.name}</span> · {wallet.amount.toLocaleString("en-US", { maximumFractionDigits: 8 })} {wallet.unit}</span>)}
          </div>}
        </div>;
      })}
    </div>
    <p className="border-t border-border px-5 py-3 text-xs text-muted-foreground sm:px-6">Gold and silver holdings are loaded from your saved metal wallets. "oz" and "ozt" are troy ounces; "lb" is a standard pound. Display rounding does not change stored quantities.</p>
  </Card>;
}

function WalletSummary({ wallets, price, currency }: { wallets: WalletStat[]; price: number | null; currency: string }) {
  return <Card>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4 sm:px-6"><div><h2 className="text-lg font-semibold">Bitcoin wallets</h2><p className="mt-1 text-xs text-muted-foreground">Balances and transaction activity from connected addresses</p></div><Link href="/dashboard/wallets" className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline">Manage wallets <ArrowRight size={15}/></Link></div>
    {wallets.length === 0 ? <div className="flex flex-col items-start gap-3 px-6 py-10"><Wallet size={30} className="text-muted-foreground"/><div className="font-semibold">No wallets connected yet</div><p className="text-sm text-muted-foreground">Connect a Bitcoin address to start tracking your balance and accumulation history.</p><Link href="/dashboard/wallets" className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted">Connect a wallet <ArrowRight size={15}/></Link></div> : <div className="divide-y divide-border">{wallets.map(wallet => <div key={wallet.address} className="grid min-w-0 gap-x-3 gap-y-3 px-5 py-4 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,.75fr)_minmax(0,.75fr)] sm:items-center sm:px-6">
      <div className="min-w-0"><div className="flex items-center gap-2"><AssetMark asset="bitcoin" size={30}/><div className="min-w-0"><p className="text-sm font-semibold">Bitcoin address</p><p title={wallet.address} className="truncate font-mono text-[11px] text-muted-foreground">{wallet.address}</p></div></div></div>
      <div className="flex items-center justify-between sm:block"><span className="text-xs text-muted-foreground">Balance</span><div className="text-right sm:text-left"><p className="text-sm font-semibold">{formatBtc(wallet.balance)}</p><p className="text-xs text-muted-foreground">{price == null ? "—" : formatMoney(asBtc(wallet.balance) * price, currency)}</p></div></div>
      <div className="flex items-center justify-between sm:block sm:text-right"><span className="text-xs text-muted-foreground">Activity</span><div><p className="text-sm font-semibold">{wallet.txCount.toLocaleString()} transactions</p><p className="text-xs text-muted-foreground">{formatSats(wallet.totalReceived)} received · {formatSats(wallet.totalSent)} sent</p><p className="text-xs text-muted-foreground">{formatSats(wallet.pendingDelta)} pending</p></div></div>
    </div>)}</div>}
  </Card>;
}

function NetFlows({ points }: { points: ChartPoint[] }) {
  const activity = points.filter(point => Number.isFinite(Number(point.flow)) && Number(point.flow) !== 0).sort((a, b) => timestamp(b.t) - timestamp(a.t));
  return <Card>
    <div className="border-b border-border px-5 py-4 sm:px-6"><div className="flex items-center gap-2"><Activity size={17} className="text-muted-foreground"/><h2 className="text-lg font-semibold">Daily net flow</h2></div><p className="mt-1 text-xs text-muted-foreground">Changes in tracked Bitcoin balance, not a purchase history</p></div>
    <div className="max-h-[420px] overflow-y-auto">{activity.length ? <table className="w-full min-w-0 text-sm"><thead className="sticky top-0 bg-card text-xs text-muted-foreground"><tr><th className="px-5 py-3 text-left font-medium sm:px-6">Date (UTC)</th><th className="px-3 py-3 text-right font-medium">Net change</th><th className="px-5 py-3 text-right font-medium sm:px-6">Running balance</th></tr></thead><tbody className="divide-y divide-border">{activity.map((point, index) => <tr key={`${point.t}-${index}`}><td className="px-5 py-3 text-xs sm:px-6 sm:text-sm">{formatUtcDate(point.t)}</td><td className={`px-3 py-3 text-right text-xs font-medium tabular-nums sm:text-sm ${toNumber(point.flow) < 0 ? "text-red-500" : "text-foreground"}`}>{toNumber(point.flow) > 0 ? "+" : ""}{formatSats(point.flow)}</td><td className="px-5 py-3 text-right text-xs tabular-nums sm:px-6 sm:text-sm">{formatBtc(point.cum)}</td></tr>)}</tbody></table> : <div className="px-6 py-10 text-center text-sm text-muted-foreground">No balance-changing activity in the available period.</div>}</div>
  </Card>;
}

export default function PortfolioPage() {
  const { user, loading: authLoading } = useAuth();
  const { currency } = useCurrency();
  const { data, error, isLoading, isValidating, mutate } = useSWR(user ? ["portfolio:btc", user.uid] : null, getPortfolio, { refreshInterval: 60_000 });
  const { data: metals, error: metalsError, isLoading: metalsLoading, isValidating: metalsValidating, mutate: refreshMetals } = useSWR(user ? ["portfolio:metals", user.uid] : null, getMetals, { refreshInterval: 60_000 });
  const { data: marketData, isLoading: marketLoading } = useSWR(`/api/public/markets?currency=${currency}`, getPublicMarkets, { refreshInterval: 60_000, keepPreviousData: false });
  const market = marketData?.currency === currency ? marketData.assets : [];
  const bitcoinQuote = market.find(asset => asset.id === "bitcoin");
  const goldQuote = market.find(asset => asset.id === "gold");
  const silverQuote = market.find(asset => asset.id === "silver");
  const totals = data?.summary?.totals ?? EMPTY_TOTALS;
  const wallets = data?.summary?.wallets ?? [];
  const btcBalance = asBtc(totals.balance);
  const price = bitcoinQuote?.price ?? (currency === "USD" ? data?.btcStats?.priceUsd ?? null : null);
  const metalWalletData = metalsError ? null : metals;
  const goldQuantity = metalWalletData ? totalTroyOunces(metalWalletData.gold) : null;
  const silverQuantity = metalWalletData ? totalTroyOunces(metalWalletData.silver) : null;
  const valueOf = (quantity: number | null, quote: number | null): number | null =>
    quantity === null ? null : quantity === 0 ? 0 : quote === null ? null : quantity * quote;
  const positions: PortfolioPosition[] = [
    { id: "bitcoin", quantity: btcBalance, price, value: valueOf(btcBalance, price), wallets: [] },
    { id: "gold", quantity: goldQuantity, price: goldQuote?.price ?? null, value: valueOf(goldQuantity, goldQuote?.price ?? null), wallets: metalWalletData?.gold ?? [] },
    { id: "silver", quantity: silverQuantity, price: silverQuote?.price ?? null, value: valueOf(silverQuantity, silverQuote?.price ?? null), wallets: metalWalletData?.silver ?? [] },
  ];
  // Never show a misleading BTC-only total if metals failed to load or a quote is missing.
  const portfolioValue = positions.every(position => position.value !== null)
    ? positions.reduce((sum, position) => sum + (position.value ?? 0), 0)
    : null;
  const refreshAll = () => { void mutate(); void refreshMetals(); };

  const txCount = wallets.reduce((sum, wallet) => sum + (wallet.txCount || 0), 0);
  const btc24h = bitcoinQuote?.change24h ?? (currency === "USD" ? (
    typeof data?.btcStats?.change24hPct === "number" ? data.btcStats.change24hPct :
    typeof data?.btcStats?.change24h === "number" ? data.btcStats.change24h * 100 : null
  ) : null);

  if (authLoading || (user && isLoading)) {
    return <main className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8"><div className="animate-pulse space-y-5"><div className="h-8 w-52 rounded-lg bg-muted"/><div className="h-36 rounded-2xl bg-muted"/><div className="grid gap-4 sm:grid-cols-4">{[1, 2, 3, 4].map(item => <div key={item} className="h-28 rounded-xl bg-muted"/>)}</div><div className="h-80 rounded-2xl bg-muted"/></div></main>;
  }
  if (!user) {
    return <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6"><Card className="p-8"><ShieldCheck size={26} className="text-muted-foreground"/><h1 className="mt-4 text-2xl font-semibold">Your private portfolio</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to see your connected Bitcoin wallets and portfolio analysis.</p><Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold hover:underline">Back to markets <ArrowRight size={15}/></Link></Card></main>;
  }
  if (error || !data) {
    return <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6"><Card className="p-8"><h1 className="text-xl font-semibold">Portfolio temporarily unavailable</h1><p className="mt-2 text-sm text-muted-foreground">Your wallet data could not be loaded. No data was modified.</p><button onClick={() => void mutate()} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium hover:bg-muted"><RefreshCw size={15}/> Try again</button></Card></main>;
  }

  return <main className="mx-auto w-full max-w-[1500px] space-y-4 px-4 pb-12 pt-5 sm:space-y-5 sm:px-6 sm:pt-8 lg:px-8">
    <header className="flex flex-wrap items-end justify-between gap-4 pb-1"><div><p className="text-[10px] font-semibold tracking-[0.13em] text-muted-foreground">YOUR WORKSPACE / PORTFOLIO</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your portfolio<span className="text-muted-foreground">.</span></h1><p className="mt-1 text-sm text-muted-foreground">Bitcoin holdings, accumulation and asset exposure in one place.</p></div><div className="flex items-center gap-2"><button type="button" onClick={refreshAll} aria-label="Refresh portfolio holdings" disabled={isValidating || metalsValidating} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-muted disabled:opacity-50"><RefreshCw size={16} className={isValidating || metalsValidating ? "animate-spin" : ""}/></button><Link href="/dashboard/wallets" className="inline-flex h-9 items-center gap-2 rounded-lg bg-foreground px-3.5 text-sm font-medium text-background hover:opacity-90"><Wallet size={16}/> Manage wallets</Link></div></header>

    <Card className="relative overflow-hidden p-5 sm:p-7"><div className="absolute inset-y-0 right-0 hidden w-1/3 bg-gradient-to-l from-muted/60 to-transparent sm:block" aria-hidden="true"/><div className="relative flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracked portfolio value</p><p className="mt-3 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">{portfolioValue == null ? "—" : formatMoney(portfolioValue, currency)}</p><p className="mt-2 text-xs text-muted-foreground">Bitcoin, gold and silver wallet holdings · {currency} market valuation · Pending BTC Δ: {formatSats(totals.pendingDelta)}</p>{metalsError && <p className="mt-2 text-xs text-red-500">Metal wallets could not be loaded. Portfolio total is withheld rather than showing an incomplete value. <button type="button" className="font-semibold underline" onClick={() => void refreshMetals()}>Retry</button></p>}{!metalsError && portfolioValue === null && <p className="mt-2 text-xs text-muted-foreground">{metalsLoading ? "Loading metal wallets…" : "Waiting for a current asset quote to calculate the complete portfolio value."}</p>}</div><div className="grid grid-cols-2 gap-6 sm:gap-9"><div><p className="text-xs text-muted-foreground">Bitcoin owned</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatBtc(totals.balance)}</p></div><div><p className="text-xs text-muted-foreground">BTC 24h market move</p><div className="mt-1 text-lg">{percentChange(btc24h)}</div></div></div></div></Card>

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><Metric label="Connected wallets" value={wallets.length.toLocaleString()} sub="Bitcoin addresses" icon={<Wallet size={16}/>}/><Metric label="Transactions" value={txCount.toLocaleString()} sub="Across connected wallets" icon={<Activity size={16}/>}/><Metric label="Total received" value={formatBtc(totals.totalReceived)} sub={formatSats(totals.totalReceived)} icon={<ArrowDownRight size={16}/>}/><Metric label="Total sent" value={formatBtc(totals.totalSent)} sub={formatSats(totals.totalSent)} icon={<ArrowUpRight size={16}/>}/></div>

    <div className="grid items-stretch gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(330px,1fr)] lg:gap-5"><PortfolioChart className="min-w-0"/><PortfolioAllocation positions={positions} totalValue={portfolioValue} currency={currency}/></div>

    <AssetHoldings positions={positions} currency={currency} quotePending={marketLoading} metalsLoading={metalsLoading} metalsError={Boolean(metalsError)}/>

    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] xl:gap-5"><WalletSummary wallets={wallets} price={price} currency={currency}/><NetFlows points={data.chart?.points ?? []}/></div>

    <div className="grid gap-3 rounded-[18px] border border-border bg-muted/35 p-5 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4"><BarChart3 size={21} className="text-muted-foreground"/><div><h2 className="text-sm font-semibold">Profit and loss analysis</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Cost basis and realized gains need purchase records. Wallet deposits and transfers alone are not purchases, so gains and losses are not calculated from them.</p></div><span className="inline-flex w-fit items-center gap-1 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground"><CircleHelp size={12}/> Awaiting purchase data</span></div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><span>Wallet balances and metal holdings refresh every 60 seconds. Metal values use market prices per troy ounce.</span><Link href="/dashboard/wallets" className="inline-flex items-center gap-1 font-medium text-foreground hover:underline">Manage connected wallets <ExternalLink size={12}/></Link></div>
  </main>;
}
