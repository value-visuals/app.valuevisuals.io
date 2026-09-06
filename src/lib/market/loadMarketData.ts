import type {
  CoinStats,
  CryptoSummary,
  MetalsSummary,
  MarketCurrency,
} from "@/stores/marketStore";

import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

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

  /*
   * Firebase-backed crypto charts.
   *
   * Keys:
   *
   *   BTC
   *   ETH
   *   XMR
   */
  cryptoCharts: Record<
    string,
    CryptoChart
  >;

  /*
   * Individual crypto stats.
   *
   * These use the same existing endpoints
   * used by the individual crypto pages
   * and CryptoTopTiles.
   *
   * CoinStats includes:
   *
   *   priceUsd
   *   change24hPct
   *   change24h
   *   marketCapUsd
   *   volume24hUsd
   *   dominancePct
   */
  bitcoinStats: CoinStats;
  ethereumStats: CoinStats;
  moneroStats: CoinStats;
};

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const CRYPTO_SYMBOLS = [
  "BTC",
  "ETH",
  "XMR",
] as const;

const METAL_BASES = [
  "gold",
  "silver",
] as const;

const DEFAULT_CHART_DAYS = 30;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

async function fetchJson<T>(
  url: string
): Promise<T> {
  const response =
    await authenticatedFetch(url);

  if (!response.ok) {
    const body =
      await response
        .json()
        .catch(() => ({}));

    const error = new Error(
      body?.error ||
        `Request failed: ${response.status} ${response.statusText}`
    );

    /*
     * Preserve backend auth information
     * for later handling.
     */
    (error as any).status =
      response.status;

    (error as any).code =
      body?.code;

    /*
     * Preserve the requested URL so the
     * caller can identify which market
     * request failed.
     */
    (error as any).url =
      url;

    throw error;
  }

  return response.json();
}

// -----------------------------------------------------------------------------
// Crypto stats loader
// -----------------------------------------------------------------------------

async function fetchCryptoStats(
  asset:
    | "bitcoin"
    | "ethereum"
    | "monero",
  currency: MarketCurrency
): Promise<CoinStats> {
  /*
   * These are the EXISTING endpoints
   * already used by marketStore.ts.
   *
   * Do not use:
   *
   *   /api/crypto/btc
   *   /api/crypto/eth
   *   /api/crypto/xmr
   */
  const params =
    new URLSearchParams();

  params.set(
    "currency",
    currency
  );

  const url =
    `/api/crypto/${asset}?${params.toString()}`;

  return fetchJson<CoinStats>(
    url
  );
}

// -----------------------------------------------------------------------------
// Load all crypto stats
// -----------------------------------------------------------------------------

async function fetchAllCryptoStats(
  currency: MarketCurrency
): Promise<{
  bitcoinStats: CoinStats;
  ethereumStats: CoinStats;
  moneroStats: CoinStats;
}> {
  /*
   * Load the same individual stats
   * that become available when visiting
   * /bitcoin, /ethereum and /monero.
   *
   * This makes dominance available on
   * the initial dashboard load instead
   * of requiring the user to visit each
   * asset page first.
   */
  const [
    bitcoinStats,
    ethereumStats,
    moneroStats,
  ] = await Promise.all([
    fetchCryptoStats(
      "bitcoin",
      currency
    ),

    fetchCryptoStats(
      "ethereum",
      currency
    ),

    fetchCryptoStats(
      "monero",
      currency
    ),
  ]);

  return {
    bitcoinStats,
    ethereumStats,
    moneroStats,
  };
}

// -----------------------------------------------------------------------------
// Crypto chart loader
// -----------------------------------------------------------------------------

async function fetchCryptoChart(
  symbol: string,
  currency: MarketCurrency,
  days: number
): Promise<CryptoChart> {
  const params =
    new URLSearchParams();

  /*
   * The frontend chart route accepts
   * coin names as well as symbols.
   *
   * Use the symbol here because it maps
   * directly to the Firebase-backed
   * backend API.
   */
  params.set(
    "coin",
    symbol.toLowerCase()
  );

  params.set(
    "days",
    String(days)
  );

  params.set(
    "currency",
    currency
  );

  const url =
    `/api/crypto/chart?${params.toString()}`;

  return fetchJson<CryptoChart>(
    url
  );
}

// -----------------------------------------------------------------------------
// Load all crypto charts
// -----------------------------------------------------------------------------

async function fetchCryptoCharts(
  currency: MarketCurrency,
  days: number
): Promise<
  Record<string, CryptoChart>
> {
  /*
   * Load BTC, ETH and XMR in parallel.
   *
   * Each request goes through:
   *
   *   authenticatedFetch()
   *       ↓
   *   Next.js /api/crypto/chart
   *       ↓
   *   Node API /api/crypto/chart
   *       ↓
   *   Firebase
   */
  const results =
    await Promise.all(
      CRYPTO_SYMBOLS.map(
        async (symbol) => {
          const chart =
            await fetchCryptoChart(
              symbol,
              currency,
              days
            );

          return [
            symbol,
            chart,
          ] as const;
        }
      )
    );

  return Object.fromEntries(
    results
  );
}

// -----------------------------------------------------------------------------
// Load metals
// -----------------------------------------------------------------------------

async function fetchMetalsSummary(
  currency: MarketCurrency
): Promise<MetalsSummary> {
  /*
   * /api/metals/summary accepts a
   * single base at a time.
   *
   * Therefore we explicitly request
   * both Gold (XAU) and Silver (XAG)
   * and combine their items.
   *
   * This is important because omitting
   * `base` causes the API route to
   * default to XAU.
   */
  const results =
    await Promise.all(
      METAL_BASES.map(
        async (metal) => {
          const params =
            new URLSearchParams();

          params.set(
            "base",
            metal
          );

          params.set(
            "currency",
            currency
          );

          const url =
            `/api/metals/summary?${params.toString()}`;

          return fetchJson<MetalsSummary>(
            url
          );
        }
      )
    );

  /*
   * Preserve the MetalsSummary shape
   * already consumed throughout the app.
   *
   * The important part for MarketList
   * is that `items` now contains both
   * the XAU and XAG entries.
   */
  const items =
    results.flatMap(
      (result) =>
        Array.isArray(result?.items)
          ? result.items
          : []
    );

  /*
   * Preserve any additional metadata
   * from the first response while
   * replacing items with the combined
   * Gold + Silver collection.
   */
  return {
    ...(results[0] ?? {}),
    items,
  };
}

// -----------------------------------------------------------------------------
// Load market data
// -----------------------------------------------------------------------------

export async function loadMarketData(
  currency: MarketCurrency
): Promise<LoadResult> {
  const currencyParam =
    encodeURIComponent(
      currency
    );

  // ---------------------------------------------------------------------------
  // Summary endpoint
  // ---------------------------------------------------------------------------

  const cryptoUrl =
    `/api/crypto/summary?currency=${currencyParam}`;

  /*
   * Metals are loaded through
   * fetchMetalsSummary() because the
   * API requires one base per request.
   *
   * Do not use:
   *
   *   /api/metals/summary?currency=...
   *
   * by itself because that endpoint
   * defaults to XAU.
   */

  // ---------------------------------------------------------------------------
  // Load summaries, individual crypto stats and charts
  // ---------------------------------------------------------------------------

  const [
    cryptoSummary,
    metalsSummary,
    cryptoCharts,
    cryptoStats,
  ] = await Promise.all([
    fetchJson<CryptoSummary>(
      cryptoUrl
    ),

    fetchMetalsSummary(
      currency
    ),

    fetchCryptoCharts(
      currency,
      DEFAULT_CHART_DAYS
    ),

    fetchAllCryptoStats(
      currency
    ),
  ]);

  // ---------------------------------------------------------------------------
  // Return complete market dataset
  // ---------------------------------------------------------------------------

  return {
    cryptoSummary,
    metalsSummary,
    cryptoCharts,

    bitcoinStats:
      cryptoStats.bitcoinStats,

    ethereumStats:
      cryptoStats.ethereumStats,

    moneroStats:
      cryptoStats.moneroStats,
  };
}
