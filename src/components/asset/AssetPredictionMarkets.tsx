"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowDown, ArrowUp, ExternalLink, RefreshCw } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";
import styles from "./AssetPage.module.css";

type Market = {
  eventSlug: string;
  marketSlug: string;
  question: string;
  outcomes: string[] | string | null;
  gammaOutcomePrices: number[] | string | number | null;
  clobTokenIds: string[] | unknown;
  livePrices?: Record<string, { buy: string | null; sell: string | null }> | null;
  volume24hr: number | string | null;
  liquidity: number | string | null;
  endDate: string | null;
  url: string;
};

type ApiResponse = { count: number; data: Market[] };
type SortKey = "volume" | "liquidity";
type SortDirection = "high" | "low";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1,
});

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function asArray(input: unknown): unknown[] {
  if (Array.isArray(input)) return input;
  if (typeof input !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(input);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function probabilityValues(input: unknown): number[] {
  const values = asArray(input);
  if (!values.length && (typeof input === "number" || typeof input === "string")) {
    const single = Number(input);
    if (Number.isFinite(single) && single >= 0 && single <= 1) return [single];
  }
  return values.map(Number).filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
}

function outcomeNames(input: unknown): string[] {
  return asArray(input).filter((value): value is string => typeof value === "string");
}

function tokenIds(input: unknown): string[] {
  const parsed = asArray(input);
  if (parsed.every((value) => typeof value === "string")) return parsed as string[];
  // Some stored API payloads have split JSON strings. Do not fabricate token IDs.
  return [];
}

function marketUrl(market: Market): string {
  const raw = market.url || `/event/${encodeURIComponent(market.eventSlug)}`;
  try {
    const parsed = new URL(raw, "https://polymarket.com");
    if (parsed.protocol === "https:" && (parsed.hostname === "polymarket.com" || parsed.hostname === "www.polymarket.com")) return parsed.href;
  } catch {
    // Ignore malformed upstream URL.
  }
  return "https://polymarket.com";
}

function formatDate(input: string | null): string | null {
  if (!input) return null;
  const date = new Date(input);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

async function fetcher([url]: [string, string]): Promise<ApiResponse> {
  const response = await authenticatedFetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load prediction markets (${response.status})`);
  return response.json();
}

function SummaryItem({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return <div className={styles.predStat}>
    <dt>{title}</dt>
    <dd>{value}</dd>
    {detail && <span>{detail}</span>}
  </div>;
}

function MarketCard({ market, rank }: { market: Market; rank: number }) {
  const names = outcomeNames(market.outcomes);
  const prices = probabilityValues(market.gammaOutcomePrices);
  const first = prices[0] ?? null;
  const second = prices[1] ?? null;
  const firstName = names[0] ?? "Yes";
  const secondName = names[1] ?? "No";
  const isBinary = prices.length === 2;
  const ids = tokenIds(market.clobTokenIds);
  const bidAsk = ids.length ? market.livePrices?.[ids[0]] : undefined;
  const endDate = formatDate(market.endDate);

  return <article className={styles.marketCard}>
    <div className={styles.cardTop}>
      <span className={styles.marketRank}>{rank}</span>
      <a href={marketUrl(market)} target="_blank" rel="noopener noreferrer" className={styles.marketTitle}>
        {market.question} <ExternalLink size={12} aria-label="Opens Polymarket in a new tab" />
      </a>
    </div>
    <div className={styles.marketProbabilities}>
      <div className={styles.mainOutcome}>
        <span>{firstName}</span>
        <strong>{first === null ? "—" : pct(first)}</strong>
      </div>
      <div className={styles.secondOutcome}>
        <span>{secondName}</span>
        <strong>{second === null ? "—" : pct(second)}</strong>
      </div>
    </div>
    {isBinary && first !== null && <div className={styles.probabilityTrack} role="img" aria-label={`${firstName}: ${pct(first)}; ${secondName}: ${second === null ? "unknown" : pct(second)}`}>
      <div className={styles.probabilityBar} style={{ width: `${Math.max(0, Math.min(100, first * 100))}%` }} />
    </div>}
    {bidAsk && (bidAsk.buy != null || bidAsk.sell != null) && <div className={styles.bidAsk}>
      <span>Live {firstName} quote</span>
      <span>Buy <strong>{bidAsk.buy ?? "—"}</strong></span>
      <span>Sell <strong>{bidAsk.sell ?? "—"}</strong></span>
    </div>}
    <div className={styles.marketFooter}>
      <span>24h vol. <strong>{usd.format(number(market.volume24hr))}</strong></span>
      <span>Liquidity <strong>{usd.format(number(market.liquidity))}</strong></span>
      {endDate && <span className={styles.marketDate}>Ends {endDate}</span>}
    </div>
  </article>;
}

export default function AssetPredictionMarkets({ asset, limit = 8 }: { asset: string; limit?: number }) {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<SortKey>("volume");
  const [direction, setDirection] = useState<SortDirection>("high");
  const query = new URLSearchParams({ limit: String(limit), livePrices: "1" });
  const key: [string, string] | null = user ? [`/api/polymarket/${encodeURIComponent(asset)}?${query.toString()}`, user.uid] : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<ApiResponse>(key, fetcher, {
    refreshInterval: 15_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });
  const markets = useMemo(() => data?.data ?? [], [data]);
  const orderedMarkets = useMemo(() => [...markets].sort((a, b) => {
    const left = sortBy === "volume" ? number(a.volume24hr) : number(a.liquidity);
    const right = sortBy === "volume" ? number(b.volume24hr) : number(b.liquidity);
    return direction === "high" ? right - left : left - right;
  }).slice(0, limit), [markets, sortBy, direction, limit]);
  const summary = useMemo(() => {
    const mostActive = [...markets].sort((a, b) => number(b.volume24hr) - number(a.volume24hr))[0] ?? null;
    const deepest = [...markets].sort((a, b) => number(b.liquidity) - number(a.liquidity))[0] ?? null;
    const decided = markets.flatMap((market) => {
      const prices = probabilityValues(market.gammaOutcomePrices);
      const names = outcomeNames(market.outcomes);
      if (prices.length !== 2) return [];
      const index = prices[0] >= prices[1] ? 0 : 1;
      return [{ market, probability: prices[index], outcome: names[index] ?? (index === 0 ? "Yes" : "No") }];
    }).sort((a, b) => b.probability - a.probability)[0] ?? null;
    return {
      volume: markets.reduce((sum, item) => sum + number(item.volume24hr), 0),
      liquidity: markets.reduce((sum, item) => sum + number(item.liquidity), 0),
      mostActive, deepest, decided,
    };
  }, [markets]);

  if (!user) return <div className={styles.marketEmpty}>Sign in to view prediction markets and live quotes. Market prices and charts remain publicly available.</div>;
  if (isLoading && !data) return <div className={styles.marketEmpty} aria-live="polite">Loading prediction markets…</div>;
  if (error && !data) return <div className={styles.marketEmpty}>
    <p>Prediction markets are temporarily unavailable.</p>
    <button type="button" className={styles.sortButton} onClick={() => void mutate()}>Retry</button>
  </div>;

  return <div className={styles.predictionContent}>
    <div className={styles.activityPanel}>
      <div className={styles.activityHeading}>
        <div><span className={styles.kicker}>POLYMARKET ACTIVITY</span><h3>Contract intelligence</h3></div>
        <span className={styles.muted}>Volume and liquidity in USD</span>
      </div>
      <dl className={styles.predStats}>
        <SummaryItem title="Markets in sample" value={integer.format(markets.length)} detail={data && data.count > markets.length ? `${integer.format(data.count)} reported in feed` : "Active contracts"} />
        <SummaryItem title="24h trading volume" value={usd.format(summary.volume)} detail="Across returned markets" />
        <SummaryItem title="Available liquidity" value={usd.format(summary.liquidity)} detail="Across returned markets" />
      </dl>
      {markets.length > 0 && <div className={styles.signalGrid}>
        {summary.mostActive && <div><span>Most active</span><p>{summary.mostActive.question}</p><strong>{usd.format(number(summary.mostActive.volume24hr))} / 24h</strong></div>}
        {summary.decided && <div><span>Highest priced outcome</span><p>{summary.decided.market.question}</p><strong>{summary.decided.outcome}: {pct(summary.decided.probability)}</strong></div>}
        {summary.deepest && <div><span>Deepest liquidity</span><p>{summary.deepest.question}</p><strong>{usd.format(number(summary.deepest.liquidity))}</strong></div>}
      </div>}
      <p className={styles.analysisNotice}>Contracts can have different price thresholds and settlement dates. Their probabilities are displayed individually rather than combined into an unreliable bullish/bearish score.</p>
    </div>

    <div className={styles.marketsToolbar}>
      <div><h3>Active markets</h3><p>Sorted by {sortBy === "volume" ? "24h volume" : "liquidity"} · {integer.format(orderedMarkets.length)} shown</p></div>
      <div className={styles.marketActions}>
        <div className={styles.segment} role="group" aria-label="Sort markets by">
          <button type="button" aria-pressed={sortBy === "volume"} className={sortBy === "volume" ? styles.activeSegment : undefined} onClick={() => setSortBy("volume")}>Volume</button>
          <button type="button" aria-pressed={sortBy === "liquidity"} className={sortBy === "liquidity" ? styles.activeSegment : undefined} onClick={() => setSortBy("liquidity")}>Liquidity</button>
        </div>
        <button type="button" className={styles.sortButton} onClick={() => setDirection((current) => current === "high" ? "low" : "high")}>{direction === "high" ? <ArrowDown size={13}/> : <ArrowUp size={13}/>} {direction === "high" ? "High" : "Low"}</button>
        <button type="button" className={styles.sortButton} disabled={isValidating} onClick={() => void mutate()} aria-label="Refresh prediction markets" title="Refresh prediction markets"><RefreshCw size={14}/></button>
      </div>
    </div>
    {orderedMarkets.length ? <div className={styles.marketGrid}>
      {orderedMarkets.map((market, index) => <MarketCard key={`${market.eventSlug}-${market.marketSlug}-${index}`} market={market} rank={index + 1} />)}
    </div> : <div className={styles.marketEmpty}>No active markets found for this asset.</div>}
    {error && data && <p className={styles.dataNotice}>Live refresh failed. Showing the last available prediction-market data.</p>}
  </div>;
}
