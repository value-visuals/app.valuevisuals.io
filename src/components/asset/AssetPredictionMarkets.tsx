"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { ArrowDown, ArrowUp, ExternalLink, RefreshCw, Search } from "lucide-react";
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

function amount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function probabilities(input: unknown): number[] {
  const parsed = asArray(input);
  if (!parsed.length && (typeof input === "string" || typeof input === "number")) {
    const single = Number(input);
    return Number.isFinite(single) && single >= 0 && single <= 1 ? [single] : [];
  }
  return parsed.map(Number).filter((value) => Number.isFinite(value) && value >= 0 && value <= 1);
}

function names(input: unknown): string[] {
  return asArray(input).filter((value): value is string => typeof value === "string");
}

function tokenIds(input: unknown): string[] {
  const parsed = asArray(input);
  return parsed.every((value) => typeof value === "string") ? parsed as string[] : [];
}

function marketUrl(market: Market): string {
  const raw = market.url || `/event/${encodeURIComponent(market.eventSlug)}`;
  try {
    const url = new URL(raw, "https://polymarket.com");
    if (url.protocol === "https:" && ["polymarket.com", "www.polymarket.com"].includes(url.hostname)) {
      return url.href;
    }
  } catch {
    // A malformed upstream URL must not become an unsafe external link.
  }
  return "https://polymarket.com";
}

function dateLabel(input: string | null): string | null {
  if (!input) return null;
  const date = new Date(input);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;
}

function pct(value: number | null): string {
  return value === null ? "—" : `${(value * 100).toFixed(1)}%`;
}

function money(value: unknown): string {
  const parsed = amount(value);
  return parsed === null ? "—" : usd.format(parsed);
}

function quote(value: string | null | undefined): string {
  if (value == null || value.trim() === "") return "—";
  const parsed = Number(value);
  // CLOB prices are fractions of one dollar. Keep unrecognized data unchanged.
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
    ? `${(parsed * 100).toFixed(1)}¢` : value;
}

async function fetcher([url]: [string, string]): Promise<ApiResponse> {
  const response = await authenticatedFetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load prediction markets (${response.status})`);
  return response.json();
}

function MarketCard({ market, rank, featured }: { market: Market; rank: number; featured: boolean }) {
  const labels = names(market.outcomes);
  const values = probabilities(market.gammaOutcomePrices);
  const first = values[0] ?? null;
  const second = values[1] ?? null;
  const firstName = labels[0] ?? "Yes";
  const secondName = labels[1] ?? "No";
  const binary = values.length === 2;
  const tokens = tokenIds(market.clobTokenIds);
  const prices = tokens.length ? market.livePrices?.[tokens[0]] : null;
  const ends = dateLabel(market.endDate);

  return (
    <article className={`${styles.marketCard} ${featured ? styles.featuredMarket : ""}`}>
      <div className={styles.cardTop}>
        <span className={styles.marketRank}>{String(rank).padStart(2, "0")}</span>
        <a href={marketUrl(market)} target="_blank" rel="noopener noreferrer" className={styles.marketTitle}>
          {market.question} <ExternalLink aria-label="Opens contract on Polymarket" size={12} />
        </a>
      </div>
      <div className={styles.marketProbabilities}>
        <div className={styles.mainOutcome}><span>{firstName}</span><strong>{pct(first)}</strong></div>
        {second !== null && <div className={styles.secondOutcome}><span>{secondName}</span><strong>{pct(second)}</strong></div>}
      </div>
      {binary && first !== null && (
        <div className={styles.probabilityTrack} role="img" aria-label={`${firstName}: ${pct(first)}; ${secondName}: ${pct(second)}`}>
          <span className={styles.probabilityBar} style={{ width: `${Math.min(100, Math.max(0, first * 100))}%` }} />
        </div>
      )}
      {values.length > 2 && <div className={styles.multiOutcome}>Showing 2 of {values.length} outcomes · View full contract ↗</div>}
      {prices && (prices.buy != null || prices.sell != null) && (
        <div className={styles.bidAsk}>
          <span>{firstName} quotes</span>
          <span>Buy <strong>{quote(prices.buy)}</strong></span>
          <span>Sell <strong>{quote(prices.sell)}</strong></span>
        </div>
      )}
      <div className={styles.marketFooter}>
        <span>24h vol <strong>{money(market.volume24hr)}</strong></span>
        <span>Liquidity <strong>{money(market.liquidity)}</strong></span>
        {ends && <span className={styles.marketDate}>Ends {ends}</span>}
      </div>
    </article>
  );
}

export default function AssetPredictionMarkets({ asset, limit = 8 }: { asset: string; limit?: number }) {
  const { user } = useAuth();
  const [sortBy, setSortBy] = useState<SortKey>("volume");
  const [direction, setDirection] = useState<SortDirection>("high");
  const [search, setSearch] = useState("");
  const params = new URLSearchParams({ limit: String(limit), livePrices: "1" });
  const key: [string, string] | null = user
    ? [`/api/polymarket/${encodeURIComponent(asset)}?${params.toString()}`, user.uid]
    : null;
  const { data, error, isLoading, isValidating, mutate } = useSWR<ApiResponse>(key, fetcher, {
    refreshInterval: 15_000,
    revalidateOnFocus: false,
    keepPreviousData: true,
  });

  const markets = useMemo(() => Array.isArray(data?.data) ? data.data : [], [data]);
  const needle = search.trim().toLocaleLowerCase();
  const orderedMarkets = useMemo(() => markets
    .filter((market) => !needle || (market.question || "").toLocaleLowerCase().includes(needle))
    .sort((left, right) => {
      const a = amount(sortBy === "volume" ? left.volume24hr : left.liquidity) ?? 0;
      const b = amount(sortBy === "volume" ? right.volume24hr : right.liquidity) ?? 0;
      return direction === "high" ? b - a : a - b;
    })
    .slice(0, limit), [markets, needle, sortBy, direction, limit]);
  const overview = useMemo(() => {
    let totalVolume = 0;
    let totalLiquidity = 0;
    let hasVolume = false;
    let hasLiquidity = false;
    let top: Market | null = null;
    let topVolume = -1;
    for (const market of markets) {
      const volume = amount(market.volume24hr);
      const liquidity = amount(market.liquidity);
      if (volume !== null) {
        totalVolume += volume;
        hasVolume = true;
        if (volume > topVolume) { top = market; topVolume = volume; }
      }
      if (liquidity !== null) { totalLiquidity += liquidity; hasLiquidity = true; }
    }
    return {
      volume: hasVolume ? money(totalVolume) : "—",
      liquidity: hasLiquidity ? money(totalLiquidity) : "—",
      top,
    };
  }, [markets]);

  if (!user) return <div className={styles.marketEmpty}>Sign in to view prediction markets and live contract quotes. Price charts and market data remain available without an account.</div>;
  if (isLoading && !data) return <div className={styles.marketEmpty} aria-live="polite">Loading prediction markets…</div>;
  if (error && !data) return <div className={styles.marketEmpty}>
    <p>Prediction markets are temporarily unavailable.</p>
    <button type="button" className={styles.sortButton} onClick={() => void mutate()}>Retry</button>
  </div>;

  return (
    <div className={styles.predictionContent}>
      <div className={styles.predictionOverview}>
        <div className={styles.overviewLabel}><span className={styles.liveDot} /> MARKET ACTIVITY <span className={styles.overviewHint}>· Returned contracts only</span></div>
        <dl className={styles.predictionStats}>
          <div><dt>Active in sample</dt><dd>{markets.length.toLocaleString()}</dd></div>
          <div><dt>24h volume</dt><dd>{overview.volume}</dd></div>
          <div><dt>Available liquidity</dt><dd>{overview.liquidity}</dd></div>
        </dl>
        {overview.top && <div className={styles.mostActive}>
          <span>Most active</span>
          <a href={marketUrl(overview.top)} target="_blank" rel="noopener noreferrer">
            {overview.top.question} <ExternalLink size={11} aria-label="Opens contract on Polymarket" />
          </a>
          <strong>{money(overview.top.volume24hr)} / 24h</strong>
        </div>}
      </div>

      <div className={styles.marketsToolbar}>
        <div className={styles.toolbarTitle}>
          <h3>Active contracts</h3>
          <p>{needle ? `${orderedMarkets.length} matching the search` : `${orderedMarkets.length} shown`}{data && data.count > markets.length ? ` · ${data.count.toLocaleString()} in feed` : ""}</p>
        </div>
        <div className={styles.marketActions}>
          <label className={styles.contractSearch}>
            <Search size={14} aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a contract" aria-label="Search shown contracts" />
          </label>
          <div className={styles.segment} role="group" aria-label="Sort contracts by">
            <button type="button" aria-pressed={sortBy === "volume"} className={sortBy === "volume" ? styles.activeSegment : undefined} onClick={() => setSortBy("volume")}>Volume</button>
            <button type="button" aria-pressed={sortBy === "liquidity"} className={sortBy === "liquidity" ? styles.activeSegment : undefined} onClick={() => setSortBy("liquidity")}>Liquidity</button>
          </div>
          <button type="button" className={styles.sortButton} onClick={() => setDirection((current) => current === "high" ? "low" : "high")} aria-label={direction === "high" ? "Sort lowest first" : "Sort highest first"}>
            {direction === "high" ? <ArrowDown size={13} /> : <ArrowUp size={13} />}{direction === "high" ? "High" : "Low"}
          </button>
          <button type="button" className={styles.sortButton} disabled={isValidating} onClick={() => void mutate()} aria-label="Refresh prediction markets" title="Refresh prediction markets">
            <RefreshCw size={14} className={isValidating ? styles.spinning : undefined} />
          </button>
        </div>
      </div>
      {orderedMarkets.length > 0 ? (
        <div className={styles.marketGrid}>
          {orderedMarkets.map((market, index) => (
            <MarketCard
              key={`${market.eventSlug}-${market.marketSlug}-${index}`}
              market={market}
              rank={index + 1}
              featured={index === 0 && sortBy === "volume" && direction === "high" && !needle}
            />
          ))}
        </div>
      ) : <div className={styles.marketEmpty}>{needle ? "No returned contracts match your search." : "No active markets found for this asset."}</div>}
      {error && data && <p className={styles.dataNotice}>Live refresh failed. Showing the last available prediction-market data.</p>}
    </div>
  );
}
