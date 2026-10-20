
import type {
  CoinStats,
  CryptoAssetStats,
  CryptoSummary,
  MetalsSummary,
  MarketCurrency,
} from "@/stores/marketStore";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";

// Preserve existing exported types and return contract.
export type CryptoChartCandle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  volume: number | null;
};

export type CryptoChart = {
  symbol: string;
  currency: string;
  interval: string;
  range: string;
  days: number;
  candles: CryptoChartCandle[];
  count: number;
  rawCount?: number;
  provider: string;
  source: string;
  updatedAt: string;
};

export type LoadResult = {
  cryptoSummary: CryptoSummary;
  metalsSummary: MetalsSummary;
  cryptoCharts: Record<string, CryptoChart>;
  bitcoinStats: CoinStats;
  ethereumStats: CoinStats;
  moneroStats: CoinStats;
};

type CryptoAsset = "bitcoin" | "ethereum" | "monero";

async function fetchJson<T>(url: string): Promise<T> {
  const response = await authenticatedFetch(url);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));

    const error = new Error(
      body?.error ||
      `Request failed: ${response.status} ${response.statusText}`
    );

    Object.assign(error, {
      status: response.status,
      code: body?.code,
      url,
    });

    throw error;
  }

  return response.json() as Promise<T>;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/**
 * Build existing CoinStats from the currency-aware summary.
 * This eliminates three duplicate crypto-stat requests.
 *
 * Legacy CoinStats fields ending in "Usd" contain values
 * in the selected currency for this dashboard loader.
 */
function statsFromSummary(
  summary: CryptoSummary,
  asset: CryptoAsset,
  currency: MarketCurrency
): CoinStats {
  const stats = summary[`${asset}_stats`] as
    | CryptoAssetStats
    | undefined;

  const price =
    numberOrNull(stats?.price) ??
    numberOrNull(summary[asset]?.[currency]);

  const marketCap = numberOrNull(stats?.marketCap);

  const globalMarketCap = numberOrNull(
    summary.global_market_cap?.[currency]
  );

  const change24hPct = numberOrNull(stats?.change24hPct);

  const change24h =
    numberOrNull(stats?.change24h) ??
    (change24hPct === null ? null : change24hPct / 100);

  // CoinStats dominance is a fraction, not a percentage.
  const dominancePct =
    marketCap !== null &&
    globalMarketCap !== null &&
    globalMarketCap > 0
      ? marketCap / globalMarketCap
      : null;

  return {
    priceUsd: price,
    marketCapUsd: marketCap,
    volume24hUsd: numberOrNull(stats?.volume24h),
    change24h,
    change24hPct,
    dominancePct,
  };
}

/** The backend returns both XAU and XAG when `base` is omitted.
 * One network request replaces two duplicate conversions / Firestore lookups.
 */
export async function fetchMetalsSummary(currency: MarketCurrency): Promise<MetalsSummary> {
  const query = new URLSearchParams({ currency });
  const response = await fetchJson<MetalsSummary>(`/api/metals/summary?${query}`);
  if (!Array.isArray(response?.items)) throw new Error("Invalid metals market response");
  return response;
}


/** Independently request crypto data so metal quote failures do not blank it. */
export async function fetchCryptoMarketData(currency: MarketCurrency): Promise<Pick<LoadResult, "cryptoSummary" | "bitcoinStats" | "ethereumStats" | "moneroStats">> {
  const summary = await fetchJson<CryptoSummary>(`/api/crypto/summary?currency=${encodeURIComponent(currency)}`);
  return {
    cryptoSummary: summary,
    bitcoinStats: statsFromSummary(summary, "bitcoin", currency),
    ethereumStats: statsFromSummary(summary, "ethereum", currency),
    moneroStats: statsFromSummary(summary, "monero", currency),
  };
}

export async function loadMarketData(
  currency: MarketCurrency
): Promise<LoadResult> {
  // Fetch only data required for dashboard initialization.
  // Charts remain loaded independently by MarketChart/SWR.
  const [cryptoResult, metalsResult] = await Promise.allSettled([
    fetchCryptoMarketData(currency),
    fetchMetalsSummary(currency),
  ]);
  // Individual crypto pages must not fail merely because metal quotes failed.
  if (cryptoResult.status === "rejected") throw cryptoResult.reason;
  const crypto = cryptoResult.value;
  const metalsSummary: MetalsSummary = metalsResult.status === "fulfilled"
    ? metalsResult.value
    : { items: [] };
  const { cryptoSummary, bitcoinStats, ethereumStats, moneroStats } = crypto;

  return {
    cryptoSummary,
    metalsSummary,

    // Preserve the existing interface.
    cryptoCharts: {},

    bitcoinStats,
    ethereumStats,
    moneroStats,
  };
}
