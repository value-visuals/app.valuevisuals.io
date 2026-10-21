"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowDown, ArrowRight, ArrowUp, ExternalLink, RefreshCw, Search } from "lucide-react";
import { useCurrency } from "@/components/Currency";
import { useAuth } from "@/components/auth/AuthProvider";
import { useAuthModal } from "@/components/auth/AuthModal";
import AssetMark from "@/components/market/AssetMark";
import { clientApiUrl } from "@/lib/clientApiUrl";
import type { MarketCapRankingResponse, RankedAsset, TrackedMarketCapAsset } from "@/lib/market/assetMarketCapTypes";
import styles from "./MarketCapRanking.module.css";

type SortField = "rank" | "marketCap" | "price" | "change24hPct";
type SortDirection = "asc" | "desc";

const ASSET_LABELS: Record<TrackedMarketCapAsset, string> = {
  bitcoin: "Bitcoin", ethereum: "Ethereum", monero: "Monero", gold: "Gold", silver: "Silver",
};

async function loadRanking(url: string): Promise<MarketCapRankingResponse> {
  const result = await fetch(clientApiUrl(url), { cache: "no-store" });
  if (!result.ok) throw new Error("Ranking data is temporarily unavailable");
  const json: MarketCapRankingResponse = await result.json();
  if (json.source !== "AssetMarketCap" || !Array.isArray(json.data)) throw new Error("Invalid ranking response");
  return json;
}

function money(value: number | null, currency: string, compact = false): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : value >= 1 ? 2 : value >= 0.01 ? 4 : 8,
  }).format(value);
}

function supply(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function change(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function liveDate(value: string | null): string {
  if (!value) return "Snapshot time unavailable";
  const t = Date.parse(value);
  return Number.isFinite(t) ? `As of ${new Date(t).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : "Snapshot time unavailable";
}

function rowOrder(a: RankedAsset, b: RankedAsset, field: SortField, direction: SortDirection): number {
  if (field === "rank") return direction === "asc" ? a.rank - b.rank : b.rank - a.rank;
  const v1 = field === "marketCap" ? a.marketCapUsd : field === "price" ? a.priceUsd : a.change24hPct;
  const v2 = field === "marketCap" ? b.marketCapUsd : field === "price" ? b.priceUsd : b.change24hPct;
  if (v1 == null && v2 == null) return a.rank - b.rank;
  if (v1 == null) return 1;
  if (v2 == null) return -1;
  return (direction === "asc" ? v1 - v2 : v2 - v1) || a.rank - b.rank;
}

function AssetIdentity({ asset }: { asset: RankedAsset }) {
  return <span className={styles.assetIdentity}>
    {asset.trackedAsset ? <AssetMark asset={asset.trackedAsset} size={34} /> :
      <span className={styles.symbolIcon} aria-hidden="true">{asset.name.slice(0, 2).toUpperCase()}</span>}
    <span className={styles.identityText}><strong>{asset.name}</strong><small>{asset.ticker} <span aria-hidden="true">·</span> {asset.assetType}</small></span>
    {asset.trackedAsset && <span className={styles.trackedTag} title="Tracked on Value Visuals">VV</span>}
  </span>;
}

function AssetAction({ asset }: { asset: RankedAsset }) {
  const { user } = useAuth();
  const { openAuth } = useAuthModal();
  const id = asset.trackedAsset;
  if (!id) return <span className={styles.notTracked}>—</span>;
  const target = `/dashboard/${id}`;
  return user ?
    <Link href={target} className={styles.assetLink} aria-label={`View ${ASSET_LABELS[id]} on Value Visuals`}>
      View asset <ArrowRight size={13}/>
    </Link> :
    <button type="button" className={styles.assetLink} onClick={() => openAuth("signin", { next: target })}
      aria-label={`Sign in to view ${ASSET_LABELS[id]} on Value Visuals`}>
      View asset <ArrowRight size={13}/>
    </button>;
}

/** Shared presentation for Market Intelligence's top ten and public Top 100. */
export default function MarketCapRanking({ compact = false }: { compact?: boolean }) {
  const { currency } = useCurrency();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [trackedOnly, setTrackedOnly] = useState(false);
  const [sort, setSort] = useState<SortField>("rank");
  const [direction, setDirection] = useState<SortDirection>("asc");
  const limit = compact ? 10 : 100;
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `/api/public/market-caps?currency=${currency}&limit=${limit}`, loadRanking,
    { refreshInterval: 15 * 60 * 1000, revalidateOnFocus: false, dedupingInterval: 30_000, keepPreviousData: false }
  );
  const current = data?.currency === currency ? data : null;
  const categories = useMemo(() => Array.from(new Set(current?.data.map((row) => row.assetType) ?? [])).sort(), [current]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (current?.data ?? []).filter((row) =>
      (category === "all" || row.assetType === category) &&
      (!trackedOnly || row.trackedAsset !== null) &&
      (!q || `${row.name} ${row.ticker} ${row.assetType}`.toLowerCase().includes(q))
    ).sort((a, b) => rowOrder(a, b, sort, direction));
  }, [current, query, category, trackedOnly, sort, direction]);

  function updateSort(field: SortField) {
    if (sort === field) setDirection((old) => old === "asc" ? "desc" : "asc");
    else { setSort(field); setDirection(field === "rank" ? "asc" : "desc"); }
  }
  function sortLabel(field: SortField, label: string) {
    return <button type="button" className={styles.sortButton} onClick={() => updateSort(field)}
      aria-label={`Sort by ${label}`}>
      {label} {sort === field && (direction === "asc" ? <ArrowUp size={11}/> : <ArrowDown size={11}/>)}
    </button>;
  }

  return <section className={`${styles.ranking} ${compact ? styles.compact : ""}`} aria-label={compact ? "Top 10 global assets by market capitalization" : "Top 100 global assets by market capitalization"}>
    <div className={styles.heading}>
      <div>
        <span className={styles.eyebrow}>GLOBAL ASSET RANKINGS / ASSETMARKETCAP</span>
        <h2>{compact ? "Top 10 assets" : "Top 100 assets"}<span className={styles.accent}>.</span></h2>
        <p>Ranked by market capitalization across asset classes. Supported Value Visuals assets are highlighted.</p>
      </div>
      <div className={styles.headActions}>
        <span className={styles.currencyLabel}>{currency}</span>
        <button type="button" onClick={() => void mutate()} disabled={isValidating} className={styles.refresh} aria-label="Refresh market cap rankings" title="Refresh cached rankings"><RefreshCw size={15} className={isValidating ? "animate-spin" : ""}/></button>
        {compact && <Link href="/market-caps" className={styles.viewAll}>View all 100 <ArrowRight size={14}/></Link>}
      </div>
    </div>
    {!compact && <div className={styles.summary} aria-label="Ranking summary">
      <span><strong>{current?.count ?? "—"}</strong> ranked assets</span>
      <span><strong>{current?.data.filter((row) => row.trackedAsset).length ?? "—"}</strong> listed on Value Visuals</span>
      <span>Source prices: USD <span aria-hidden="true">·</span> Display: {currency}</span>
      <span>Estimates, not independently audited</span>
    </div>}
    {!compact && <div className={styles.filters}>
      <label className={styles.search}><Search size={15}/><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search asset or ticker" aria-label="Search assets by name or ticker"/></label>
      <label className={styles.categoryLabel}><span className="sr-only">Asset category</span><select value={category} onChange={(event) => setCategory(event.target.value)}><option value="all">All asset types</option>{categories.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
      <label className={styles.trackedFilter}><input type="checkbox" checked={trackedOnly} onChange={(event) => setTrackedOnly(event.target.checked)}/> Value Visuals only</label>
    </div>}
    {error && <div className={styles.notice} role="status">Market-cap rankings are currently unavailable. {current ? "Last snapshot remains visible." : ""} <button type="button" onClick={() => void mutate()}>Retry</button></div>}
    {!current && !error && <div className={styles.notice} role="status">{isLoading ? "Loading market-cap rankings…" : "Waiting for ranking data…"}</div>}
    {current && <>
      {current.fxRate === null && <div className={styles.notice} role="status">Currency conversion is temporarily unavailable. {currency} prices are withheld; rankings remain based on the original USD market caps.</div>}
      {current.stale && <div className={styles.notice} role="status">Source unavailable; displaying an older cached snapshot.</div>}
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead><tr>
            <th scope="col" aria-sort={sort === "rank" ? direction === "asc" ? "ascending" : "descending" : "none"}>{compact ? "#" : sortLabel("rank", "Rank")}</th>
            <th scope="col">Asset</th>
            <th scope="col">Type</th>
            <th scope="col" className={styles.num} aria-sort={sort === "price" ? direction === "asc" ? "ascending" : "descending" : "none"}>{compact ? "Price" : sortLabel("price", `Price (${currency})`)}</th>
            <th scope="col" className={styles.num} aria-sort={sort === "change24hPct" ? direction === "asc" ? "ascending" : "descending" : "none"}>{compact ? "24h" : sortLabel("change24hPct", "24h")}</th>
            <th scope="col" className={styles.num} aria-sort={sort === "marketCap" ? direction === "asc" ? "ascending" : "descending" : "none"}>{compact ? "Market cap" : sortLabel("marketCap", `Market cap (${currency})`)}</th>
            {!compact && <th scope="col" className={styles.num}>Circ. supply</th>}
            <th scope="col" className={styles.actionTitle}>Value Visuals</th>
          </tr></thead>
          <tbody>{rows.map((asset) => <tr key={`${asset.rank}:${asset.ticker}`} className={asset.trackedAsset ? styles.trackedRow : ""}>
            <td className={styles.rankCell}>{asset.rank}</td>
            <td><AssetIdentity asset={asset}/></td>
            <td><span className={styles.categoryTag}>{asset.assetType}</span></td>
            <td className={`${styles.num} ${styles.priceCell}`}>{money(asset.price, currency)}</td>
            <td className={styles.num}><span className={`${styles.change} ${asset.change24hPct != null ? asset.change24hPct >= 0 ? styles.up : styles.down : ""}`}>{change(asset.change24hPct)}</span></td>
            <td className={`${styles.num} ${styles.capCell}`}>{money(asset.marketCap, currency, true)}</td>
            {!compact && <td className={`${styles.num} ${styles.supplyCell}`}>{supply(asset.circulatingSupply)}</td>}
            <td className={styles.actionCell}><AssetAction asset={asset}/></td>
          </tr>)}</tbody>
        </table>
      </div>
      {!rows.length && <div className={styles.notice}>No assets match the selected filters.</div>}
      <div className={styles.footer}>
        <div><span>{liveDate(current.asOf)}</span><span className={styles.separator}>·</span><span>{rows.length} shown</span></div>
        <div>Source: <a href="https://assetmarketcap.com/" target="_blank" rel="noopener noreferrer">AssetMarketCap <ExternalLink size={12}/></a>{!compact && <><span className={styles.separator}>·</span><span>USD conversions via Frankfurter</span></>}</div>
      </div>
      {!compact && <p className={styles.disclaimer}>Market capitalization rankings are sourced from AssetMarketCap and may include estimates for commodities, real estate, currencies and other non-fungible assets. Their unit prices are the provider's reference values, not Value Visuals spot quotes. Figures are informational, not investment advice.</p>}
    </>}
  </section>;
}
