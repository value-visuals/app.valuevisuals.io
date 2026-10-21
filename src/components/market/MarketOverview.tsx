"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowDownRight, ArrowRight, ArrowUpRight, CircleHelp, ExternalLink, RefreshCw, Search } from "lucide-react";
import { useCurrency } from "@/components/Currency";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModal";
import { clientApiUrl } from "@/lib/clientApiUrl";
import { formatMoney, formatChange } from "@/lib/market/format";
import { ASSETS, type MarketAsset, type MarketAssetId, type PublicMarkets } from "@/lib/market/publicMarketTypes";
import AssetMark from "./AssetMark";
import MarketPriceChart, { type ChartPerformance, type ChartRangeDays } from "./MarketPriceChart";
import OverviewHighlights from "./OverviewHighlights";
import Sparkline from "./Sparkline";

async function getMarkets(url: string): Promise<PublicMarkets> {
  const response = await fetch(clientApiUrl(url), { cache: "no-store" });
  if (!response.ok) throw new Error("Market data temporarily unavailable");
  return response.json();
}
const fallback = ASSETS.map(asset => ({ ...asset, price: null, change24h: null, change7d: null, marketCap: null, volume24h: null, sparkline: [], source: "Awaiting quotes" } satisfies MarketAsset));
type Category = "All assets" | "Crypto" | "Metals";

function Change({ value }: { value: number | null }) {
  if (value == null) return <span className="subtle">—</span>;
  return <span className={`change-pill ${value >= 0 ? "positive" : "negative"}`}>{value >= 0 ? <ArrowUpRight size={13}/> : <ArrowDownRight size={13}/>} {formatChange(value)}</span>;
}

export default function MarketOverview() {
  const { currency } = useCurrency();
  const { user } = useAuth();
  const { openAuth } = useAuthModal();
  const [selectedId, setSelectedId] = useState<MarketAssetId>("bitcoin");
  const [chartDays, setChartDays] = useState<ChartRangeDays>("7");
  const [chartPerformance, setChartPerformance] = useState<ChartPerformance | null>(null);
  const onChartPerformance = useCallback((value: ChartPerformance) => setChartPerformance(value), []);
  const [category, setCategory] = useState<Category>("All assets");
  const [query, setQuery] = useState("");
  const { data, error, isLoading, isValidating, mutate } = useSWR(`/api/public/markets?currency=${currency}`, getMarkets, {
    refreshInterval: 60_000, revalidateOnFocus: true, keepPreviousData: false, dedupingInterval: 40_000,
  });
  const assets = data && data.currency === currency ? data.assets : fallback;
  const selected = assets.find(asset => asset.id === selectedId) ?? assets[0];
  const performanceMatches = chartPerformance?.asset === selected.id && chartPerformance.currency === currency && chartPerformance.days === chartDays;
  const selectedChange = performanceMatches ? chartPerformance.change : null;
  const selectedPeriod = chartDays === "1" ? "last 24 hours" : `last ${chartDays} days`;
  const filtered = useMemo(() => assets.filter(asset => (category === "All assets" || category === asset.category) && `${asset.name} ${asset.symbol}`.toLowerCase().includes(query.trim().toLowerCase())), [assets, category, query]);
  const lastUpdated = data?.updatedAt ? new Date(data.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : "—";
  const available = assets.filter(asset => asset.price != null).length;

  useEffect(() => {
    const syncHash = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1)).toLowerCase();
      if (hash === "crypto") setCategory("Crypto");
      else if (hash === "metals") setCategory("Metals");
      else if (hash === "markets") setCategory("All assets");
      else if (ASSETS.some(a => a.id === hash)) { setSelectedId(hash as MarketAssetId); setCategory("All assets"); }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return <main className="enterprise-main" id="overview">
    <div className="enterprise-market-heading">
      <div>
        <h1 className="sr-only">Market overview</h1>
        <div className="enterprise-breadcrumb">MARKETS <span>/</span> OVERVIEW <span className="live-chip"><span className="live-orb"/> LIVE</span></div>
      </div>
      <div className="enterprise-market-heading-actions"><button type="button" className="enterprise-refresh" aria-label="Refresh market quotes" title="Refresh quotes" onClick={() => void mutate()} disabled={isValidating}><RefreshCw size={16} className={isValidating ? "animate-spin" : ""}/></button></div>
    </div>

    <div className="enterprise-meta-row"><span><span className="live-orb"/> {available} of 5 asset feeds available</span><i/><span>{isLoading ? "Loading market data" : isValidating ? "Updating quotes…" : `Updated ${lastUpdated}`}</span><i/><span>{data?.stale ? "Using last known public quotes" : "Public market reference"}</span></div>

    <OverviewHighlights currency={currency} data={data}/>

    <h2 className="sr-only">Asset performance</h2>
    <div id="crypto" className="enterprise-anchor"/><div id="metals" className="enterprise-anchor"/>
    <div className="enterprise-data-grid" id="markets">
      <section className="enterprise-panel enterprise-table-panel" aria-label="Market asset prices">
        <div className="enterprise-table-toolbar"><div className="enterprise-filter-tabs" role="group" aria-label="Asset category">{(["All assets", "Crypto", "Metals"] as const).map(option => <button key={option} type="button" aria-pressed={category === option} onClick={() => setCategory(option)}>{option}</button>)}</div><label className="enterprise-search"><Search size={16}/><input type="search" aria-label="Search assets" value={query} onChange={event => setQuery(event.target.value)} placeholder="Find an asset…" /></label></div>
        {error && <div className="enterprise-error" role="status">Live quotes are temporarily unavailable. <button type="button" onClick={() => void mutate()}>Retry</button></div>}
        <div className="enterprise-table-wrap"><table className="enterprise-market-table"><thead><tr><th scope="col">Asset</th><th scope="col" className="num">Price</th><th scope="col" className="num">24h</th><th scope="col" className="num hide-under-md">7d</th><th scope="col" className="num hide-under-lg">Market cap</th><th scope="col" className="num hide-under-xl">7d chart</th></tr></thead><tbody>
          {filtered.map(asset => <tr key={asset.id} className={selected.id === asset.id ? "is-selected" : ""}>
            <td><button type="button" onClick={() => setSelectedId(asset.id)} className="enterprise-table-asset" aria-pressed={selected.id === asset.id}><AssetMark asset={asset.id} size={39}/><span><strong>{asset.name}</strong><small>{asset.symbol} <span>·</span> {asset.category}</small></span></button></td>
            <td className="num price-cell">{formatMoney(asset.price, currency)}</td><td className="num"><Change value={asset.change24h}/></td><td className="num hide-under-md"><Change value={asset.change7d}/></td><td className="num muted-cell hide-under-lg">{formatMoney(asset.marketCap, currency, true)}</td><td className="num hide-under-xl"><span className="enterprise-table-spark"><Sparkline asset={asset.id} currency={currency} values={asset.sparkline} positive={(asset.change7d ?? 0) >= 0} width={118} height={38}/></span></td>
          </tr>)}
        </tbody></table>{!filtered.length && <div className="enterprise-empty">No assets match your search.</div>}</div>
        <div className="enterprise-table-footer"><span>Showing {filtered.length} of {assets.length} assets</span><span><span className="live-orb"/> Market data updates every 60s</span></div>
      </section>

      <aside className="enterprise-panel enterprise-detail" id={selected.id} aria-label={`Detailed ${selected.name} market quote`}>
        <div className="detail-top"><div className="detail-identity"><AssetMark asset={selected.id} size={43}/><div><h3>{selected.name}</h3><span>{selected.symbol} / {currency}</span></div></div><span className="detail-category">{selected.category}</span></div>
        <div className="detail-price-area"><div className="detail-label">CURRENT PRICE</div><div className="detail-price">{formatMoney(selected.price, currency)}</div><div className="detail-change" aria-live="polite"><Change value={selectedChange}/><span>{selectedPeriod}</span></div></div>
        <MarketPriceChart asset={selected.id} currency={currency} days={chartDays} onRangeChange={setChartDays} onPerformanceChange={onChartPerformance}/>
        <div className="detail-grid"><div><span>Market cap</span><strong>{formatMoney(selected.marketCap, currency, true)}</strong></div><div><span>24h volume</span><strong>{formatMoney(selected.volume24h, currency, true)}</strong></div><div><span>7d change</span><strong>{formatChange(selected.change7d)}</strong></div><div><span>Primary source</span><strong>{selected.source}</strong></div></div>
        {user && <Link className="detail-analysis-link" href={`/dashboard/${selected.id}`}>Full {selected.name} analysis <ExternalLink size={15}/></Link>}
        {!user && <p className="detail-guest-note">Want historical portfolio data and detailed analysis? <button type="button" className="vv-inline-auth" onClick={() => openAuth("signup")}>Create your workspace <ArrowRight size={13}/></button></p>}
      </aside>
    </div>
    <div className="enterprise-disclaimer"><CircleHelp size={16}/><span>Public quotes are indicative. Gold and silver prices are per troy ounce. Metals have no market cap value in this feed. Global Fear & Greed is not calculated from Value Visuals assets.</span></div>
    {!user && <section className="enterprise-join"><div><span className="enterprise-section-eyebrow">BEYOND THE PRICE</span><h2>Make your market data personal.</h2><p>Your portfolio, wallet tracking, chart comparisons and account preferences are one sign-in away.</p></div><button type="button" className="enterprise-join-button" onClick={() => openAuth("signup")}>Create an account <ArrowRight size={17}/></button></section>}
    <footer className="enterprise-footer"><span>© {new Date().getFullYear()} Value Visuals</span><span>Independent market intelligence · Not financial advice</span></footer>
  </main>;
}
