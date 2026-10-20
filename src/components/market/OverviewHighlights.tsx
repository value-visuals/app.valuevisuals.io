"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChartNoAxesCombined, CircleHelp, Gauge, TrendingUp } from "lucide-react";
import AssetMark from "./AssetMark";
import { clientApiUrl } from "@/lib/clientApiUrl";
import { formatMoney, formatChange } from "@/lib/market/format";
import type { MarketAsset, MarketQuoteCurrency, PublicMarkets } from "@/lib/market/publicMarketTypes";

type CapResponse = { currency: MarketQuoteCurrency; days: number; points: Array<{ time: number; value: number }>; stale?: boolean; fxEstimate?: unknown; source?: "Value Visuals API" | "CoinGecko fallback" };
const ranges = [ { label: "1D", days: 1 }, { label: "7D", days: 7 }, { label: "30D", days: 30 } ] as const;
async function getCap(url: string): Promise<CapResponse> {
  const response = await fetch(clientApiUrl(url));
  if (!response.ok) throw new Error("History currently unavailable");
  return response.json();
}

function CapTile({ currency, assets }: { currency: MarketQuoteCurrency; assets: MarketAsset[] }) {
  const [days, setDays] = useState(7);
  const { data, error, isLoading } = useSWR(`/api/public/tracked-cap?days=${days}&currency=${currency}`, getCap, {
    keepPreviousData: false, refreshInterval: 300_000, revalidateOnFocus: false, dedupingInterval: 240_000,
  });
  const coins = assets.filter(a => a.category === "Crypto");
  const current = coins.length === 3 && coins.every(a => a.marketCap != null) ? coins.reduce((sum, a) => sum + a.marketCap!, 0) : null;
  const points = data && data.currency === currency && data.days === days ? data.points : [];
  const first = points[0]?.value;
  const last = points[points.length - 1]?.value;
  const pct = first && last ? (last - first) / first * 100 : null;
  const positive = pct == null || pct >= 0;
  const grad = "vv-cap-gradient";
  return <section className="enterprise-panel overview-cap" aria-labelledby="tracked-cap-title">
    <div className="panel-top"><div className="panel-kicker"><ChartNoAxesCombined size={15} /> TRACKED MARKET CAPITALIZATION</div><span className="panel-live"><span className="live-orb"/> 3 ASSETS</span></div>
    <div className="overview-cap-title"><div>
      <h2 id="tracked-cap-title" className="cap-number" aria-live="polite">{formatMoney(current ?? last ?? null, currency, true)}</h2>
      <p className="cap-description">Bitcoin + Ethereum + Monero</p>
      <div className="cap-change">{pct != null ? <span className={positive ? "positive" : "negative"}>{positive ? <ArrowUpRight size={16}/> : <ArrowDownRight size={16}/>} {formatChange(pct)}</span> : <span className="subtle">Change unavailable</span>}<span className="subtle">over {days === 1 ? "24 hours" : `${days} days`}</span></div>
    </div><div className="range-pills" role="group" aria-label="Historical market capitalization range">{ranges.map(r => <button type="button" key={r.days} onClick={() => setDays(r.days)} aria-pressed={days === r.days}>{r.label}</button>)}</div></div>
    <div className="cap-visual" role="img" aria-label={`Combined BTC, ETH and XMR historical market cap, ${days} days`}>
      {points.length > 1 ? <ResponsiveContainer width="100%" height="100%" minHeight={160}><AreaChart data={points} margin={{ left: 2, right: 0, top: 10, bottom: 0 }}>
        <defs><linearGradient id={grad} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={positive ? "#667a90" : "#ed6c77"} stopOpacity=".23"/><stop offset="100%" stopColor={positive ? "#667a90" : "#ed6c77"} stopOpacity="0"/></linearGradient></defs>
        <XAxis dataKey="time" type="number" domain={["dataMin", "dataMax"]} tickFormatter={(time: number) => new Date(time).toLocaleDateString(undefined, days === 1 ? { hour: "numeric" } : { month: "short", day: "numeric" })} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} axisLine={false} tickLine={false} minTickGap={35}/>
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Tooltip labelFormatter={value => new Date(Number(value)).toLocaleString()} formatter={value => [formatMoney(Number(value), currency, true), "Tracked cap"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" }} />
        <Area dataKey="value" type="monotone" stroke={positive ? "#667a90" : "#ed6c77"} strokeWidth={2.5} fill={`url(#${grad})`} dot={false} activeDot={{ r: 4 }} isAnimationActive={false}/>
      </AreaChart></ResponsiveContainer> : <div className="chart-status" role="status">{isLoading ? "Loading historic market cap…" : error ? "Market-cap history temporarily unavailable" : "No matched history for this range"}</div>}
    </div>
    <div className="panel-bottom"><span>Historical market caps · {data?.source ?? "Value Visuals API"}</span><span>{data?.stale ? "Cached history" : data?.fxEstimate ? "Estimated FX conversion · metals excluded" : "3 crypto assets · metals excluded"}</span></div>
  </section>;
}

function GainersTile({ assets }: { assets: MarketAsset[] }) {
  const leaders = useMemo(() => assets.filter(a => a.change24h != null && Number.isFinite(a.change24h)).sort((a, b) => b.change24h! - a.change24h!), [assets]);
  const selected = leaders.slice(0, 5);
  return <section className="enterprise-panel overview-gainers" aria-labelledby="movers-title">
    <div className="panel-top"><div className="panel-kicker"><TrendingUp size={15}/> 24H MOVERS</div><span className="panel-meta">5 ASSETS</span></div>
    <div className="panel-heading-line"><div><h2 id="movers-title">24h leaderboard</h2><p>All tracked assets ranked by performance</p></div><span className="panel-top-icon"><ArrowUpRight size={20}/></span></div>
    <div className="gainers-stack">{selected.map((asset, index) => <Link className="gainer-entry" key={asset.id} href={`/#${asset.id}`}>
      <span className="gainer-index">{String(index + 1).padStart(2, "0")}</span><AssetMark asset={asset.id} size={33}/>
      <span className="gainer-name"><strong>{asset.name}</strong><small>{asset.symbol}</small></span>
      <span className={asset.change24h! >= 0 ? "gainer-value positive" : "gainer-value negative"}>{formatChange(asset.change24h)}</span>
    </Link>)}{!selected.length && <div className="gainers-empty">Awaiting live 24-hour performance data.</div>}</div>
    <div className="panel-bottom"><span>24-hour price performance</span><Link href="/#markets">View assets <ArrowRight size={13}/></Link></div>
  </section>;
}

function SentimentTile({ sentiment }: { sentiment: PublicMarkets["sentiment"] }) {
  const value = sentiment?.value ?? null;
  const label = sentiment?.label || "Unavailable";
  const clamped = Math.max(0, Math.min(value ?? 0, 100));
  const color = value == null ? "var(--muted-foreground)" : value <= 24 ? "#ed737c" : value <= 44 ? "#eda667" : value < 56 ? "var(--foreground)" : "var(--foreground)";
  return <section className="enterprise-panel overview-sentiment" aria-labelledby="sentiment-title">
    <div className="panel-top"><div className="panel-kicker"><Gauge size={15}/> SENTIMENT</div><span className="panel-meta">CRYPTO MARKET</span></div>
    <div className="panel-heading-line"><div><h2 id="sentiment-title">Fear & Greed</h2><p>Global crypto market mood</p></div><span className="info-dot" title="This is a broad crypto sentiment indicator, not a score calculated from Value Visuals assets alone."><CircleHelp size={16}/></span></div>
    <div className="sentiment-gauge-wrap"><div className="sentiment-gauge" role="meter" aria-label="Crypto Fear and Greed Index" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value ?? undefined} style={{ "--gauge-angle": `${clamped * 3.6 - 180}deg`, "--gauge-color": color } as React.CSSProperties}>
      <span className="sentiment-value">{value ?? "—"}</span><span className="sentiment-label" style={{ color }}>{label}</span>
    </div></div>
    <div className="sentiment-extremes"><span>0 · Extreme fear</span><span>100 · Extreme greed</span></div>
    <div className="panel-bottom"><span>Updated daily</span><a href="https://alternative.me/crypto/fear-and-greed-index/" target="_blank" rel="noopener noreferrer">Source: Alternative.me <ArrowRight size={13}/></a></div>
  </section>;
}

export default function OverviewHighlights({ currency, data }: { currency: MarketQuoteCurrency; data: PublicMarkets | undefined }) {
  const assets = data?.assets ?? [];
  return <div className="enterprise-overview-grid"><CapTile currency={currency} assets={assets}/><GainersTile assets={assets}/><SentimentTile sentiment={data?.sentiment ?? null}/></div>;
}
