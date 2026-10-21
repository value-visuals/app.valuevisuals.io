/** Public, normalized market-cap ranking served by Value Visuals. No API credentials. */
export type MarketCapCurrency = "USD" | "EUR" | "GBP";
export type TrackedMarketCapAsset = "bitcoin" | "ethereum" | "monero" | "gold" | "silver";

export interface RankedAsset {
  /** Rank supplied by AssetMarketCap; preserved even when filtered on the client. */
  rank: number;
  ticker: string;
  name: string;
  assetType: string;
  marketCapUsd: number | null;
  priceUsd: number | null;
  marketCap: number | null;
  price: number | null;
  /** Percentage-point change from the provider's 24HrChange field. */
  change24hPct: number | null;
  circulatingSupply: number | null;
  trackedAsset: TrackedMarketCapAsset | null;
}

export interface MarketCapRankingResponse {
  source: "AssetMarketCap";
  sourceUrl: "https://assetmarketcap.com/";
  currency: MarketCapCurrency;
  /** The provider's snapshot timestamp, not our HTTP response time. */
  asOf: string | null;
  fetchedAt: string;
  stale: boolean;
  cacheSeconds: number;
  fxRate: number | null;
  fxAsOf: string | null;
  count: number;
  data: RankedAsset[];
}

/** Explicit mapping prevents a similarly named stock or token becoming a VV asset link. */
export function trackedMarketCapAsset(name: string, ticker: string, assetType: string): TrackedMarketCapAsset | null {
  const n = name.trim().toLowerCase();
  const t = ticker.trim().toUpperCase();
  const type = assetType.trim().toLowerCase();
  if (type === "commodity" || type === "metal" || type === "precious metal") {
    if (n === "gold" && ["GC=F", "XAU", "XAUUSD", "GOLD"].includes(t)) return "gold";
    if (n === "silver" && ["SI=F", "XAG", "XAGUSD", "SILVER"].includes(t)) return "silver";
  }
  if (type === "crypto" || type === "cryptocurrency") {
    if (n === "bitcoin" && ["BTC", "BTC-USD"].includes(t)) return "bitcoin";
    if (n === "ethereum" && ["ETH", "ETH-USD"].includes(t)) return "ethereum";
    if (n === "monero" && ["XMR", "XMR-USD"].includes(t)) return "monero";
  }
  return null;
}
