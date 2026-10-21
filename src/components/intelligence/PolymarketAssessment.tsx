"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { ArrowRight, ExternalLink, RefreshCw } from "lucide-react";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "./PolymarketAssessment.module.css";

type Asset = "bitcoin" | "ethereum" | "monero" | "gold" | "silver";
const ASSETS: { id: Asset; name: string; symbol: string }[] = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH" },
  { id: "monero", name: "Monero", symbol: "XMR" },
  { id: "gold", name: "Gold", symbol: "XAU" },
  { id: "silver", name: "Silver", symbol: "XAG" },
];

type RawMarket = {
  eventSlug?: unknown; marketSlug?: unknown; question?: unknown; url?: unknown;
  volume24hr?: unknown; liquidity?: unknown; outcomes?: unknown; gammaOutcomePrices?: unknown;
};
type Preview = {
  key: string; asset: Asset; question: string; url: string | null;
  volume24h: number | null; liquidity: number | null; yesProbability: number | null;
};
type AssetGroup = { asset: Asset; markets: Preview[]; available: boolean };
type Assessment = { groups: AssetGroup[]; updatedAt: number };

function number(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
function parseList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try { const parsed: unknown = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}
function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try { const url = new URL(value); return url.protocol === "https:" && (url.hostname === "polymarket.com" || url.hostname === "www.polymarket.com") ? url.href : null; }
  catch { return null; }
}
function normalize(row: RawMarket, asset: Asset): Preview | null {
  if (typeof row.question !== "string" || !row.question.trim()) return null;
  const outcomes = parseList(row.outcomes).map((item) => String(item).toLowerCase());
  const prices = parseList(row.gammaOutcomePrices).map((item) => Number(item));
  const yesIndex = outcomes.indexOf("yes");
  const yesProbability = outcomes.length === 2 && yesIndex >= 0 && outcomes.includes("no") &&
    Number.isFinite(prices[yesIndex]) && prices[yesIndex] >= 0 && prices[yesIndex] <= 1 ? prices[yesIndex] : null;
  const key = `${typeof row.eventSlug === "string" ? row.eventSlug : ""}/${typeof row.marketSlug === "string" ? row.marketSlug : row.question}`;
  return { key, asset, question: row.question.trim(), url: safeUrl(row.url), volume24h: number(row.volume24hr), liquidity: number(row.liquidity), yesProbability };
}

async function loadAssessment(): Promise<Assessment> {
  const results = await Promise.allSettled(ASSETS.map(async ({ id }): Promise<AssetGroup> => {
    // Existing authenticated backend endpoints; don't request expensive live CLOB quotes.
    const response = await authenticatedFetch(`/api/polymarket/${id}?limit=8&livePrices=false`, { cache: "no-store" });
    if (!response.ok) throw new Error(`Polymarket ${id} unavailable`);
    const body: { data?: RawMarket[] } = await response.json();
    if (!Array.isArray(body.data)) throw new Error("Unexpected prediction-market response");
    return { asset: id, available: true, markets: body.data.map((entry) => normalize(entry, id)).filter((value): value is Preview => value !== null) };
  }));
  const groups = ASSETS.map(({ id }, index) => results[index].status === "fulfilled"
    ? (results[index] as PromiseFulfilledResult<AssetGroup>).value
    : { asset: id, available: false, markets: [] });
  if (groups.every((group) => !group.available)) throw new Error("Prediction-market feeds unavailable");
  return { groups, updatedAt: Date.now() };
}
function compactNumber(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, notation: "compact" }).format(value);
}

export default function PolymarketAssessment() {
  const { user } = useAuth();
  const container = useRef<HTMLElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const node = container.current;
    if (!node || active) return;
    if (!("IntersectionObserver" in window)) { setActive(true); return; }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { setActive(true); observer.disconnect(); }
    }, { rootMargin: "450px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [active]);
  // Delay five protected upstream calls until the assessment is close to the viewport.
  const { data, error, isLoading, isValidating, mutate } = useSWR(user && active ? `polymarket-global-assessment:${user.uid}` : null, loadAssessment, {
    refreshInterval: 10 * 60 * 1000,
    dedupingInterval: 60_000, revalidateOnFocus: false,
  });
  const info = useMemo(() => {
    const groups = data?.groups ?? [];
    const unique = new Map<string, Preview>();
    for (const group of groups) for (const item of group.markets) {
      if (!unique.has(item.key)) unique.set(item.key, item);
    }
    const all = Array.from(unique.values()).sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
    return { groups, all, loaded: groups.filter((group) => group.available).length };
  }, [data]);

  return <section ref={container} className={styles.section} aria-label="Cross-asset Polymarket assessment">
    <header className={styles.heading}>
      <div><span className={styles.eyebrow}>PREDICTION INTELLIGENCE / ALL ASSETS</span><h2>Polymarket assessment<span className={styles.accent}>.</span></h2>
        <p>Compare contract activity across the five markets tracked by Value Visuals.</p></div>
      <div className={styles.headingActions}>
        <button type="button" aria-label="Refresh prediction markets" title="Refresh assessment" onClick={() => { if (!active) setActive(true); else void mutate(); }} disabled={isValidating}><RefreshCw size={15} className={isValidating ? "animate-spin" : ""}/></button>
        <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer">Polymarket <ExternalLink size={13}/></a>
      </div>
    </header>
    {!active && <div className={styles.notice}>Market coverage loads as you reach this section.</div>}
    {error && <div className={styles.notice} role="status">Prediction-market activity is unavailable. <button type="button" onClick={() => void mutate()}>Retry</button></div>}
    {isLoading && !data && <div className={styles.notice} role="status">Loading prediction-market coverage…</div>}
    {data && <>
      <div className={styles.stats}>
        <div><span>Feeds available</span><strong>{info.loaded}<small> / 5</small></strong></div>
        <div><span>Unique sampled contracts</span><strong>{info.all.length}</strong></div>
        <div><span>Largest sampled 24h volume</span><strong>${compactNumber(info.all[0]?.volume24h ?? null)}</strong></div>
        <div><span>Refreshed</span><strong className={styles.time}>{new Date(data.updatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</strong></div>
      </div>
      <div className={styles.assetList} role="list" aria-label="Prediction-market coverage by tracked asset">
        {ASSETS.map(({ id, name, symbol }) => {
          const group = info.groups.find((entry) => entry.asset === id);
          const byVolume = [...(group?.markets ?? [])].sort((a, b) => (b.volume24h ?? -1) - (a.volume24h ?? -1));
          const highest = byVolume[0];
          return <div key={id} role="listitem" className={styles.assetRow}>
            <Link href={`/dashboard/${id}#asset-predictions`} className={styles.assetName}><strong>{name}</strong><small>{symbol}</small></Link>
            <div className={styles.coverage}><span>{group?.available ? `${group.markets.length} sampled contracts` : "Feed unavailable"}</span><strong>{highest?.volume24h != null ? `$${compactNumber(highest.volume24h)} 24h volume` : "—"}</strong></div>
            <div className={styles.topMarket}>{highest ?
              highest.url ? <a href={highest.url} target="_blank" rel="noopener noreferrer" title={highest.question}>{highest.question} <ExternalLink size={12}/></a> : <span>{highest.question}</span>
              : <span className={styles.muted}>No active contracts in sample</span>}
            </div>
            <Link href={`/dashboard/${id}#asset-predictions`} className={styles.openAsset} aria-label={`View ${name} prediction markets`}><ArrowRight size={16}/></Link>
          </div>;
        })}
      </div>
      {info.all.length > 0 && <div className={styles.topContracts}>
        <div className={styles.subhead}><strong>Most active sampled contracts</strong><span>24h volume · USD</span></div>
        <div className={styles.contractGrid}>{info.all.slice(0, 3).map((item) => <div key={item.key} className={styles.contractCard}>
          <span className={styles.contractAsset}>{ASSETS.find((entry) => entry.id === item.asset)?.name}</span>
          {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" title={item.question}>{item.question} <ExternalLink size={12}/></a> : <strong>{item.question}</strong>}
          <div className={styles.contractMeta}><span>24h vol <strong>${compactNumber(item.volume24h)}</strong></span><span>Liquidity <strong>${compactNumber(item.liquidity)}</strong></span>{item.yesProbability !== null && <span>Yes <strong>{(item.yesProbability * 100).toFixed(1)}%</strong></span>}</div>
        </div>)}</div>
      </div>}
      <p className={styles.footnote}>Assessment covers up to eight contracts per asset, not all of Polymarket. A contract may match multiple assets; the unique total is deduplicated. Yes prices are displayed only for explicit Yes/No contracts. No overall bullish/bearish probability or combined volume is inferred.</p>
    </>}
  </section>;
}
