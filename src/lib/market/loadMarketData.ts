// src/lib/market/loadMarketData.ts

import type {
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
};

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const CRYPTO_SYMBOLS = [
  "BTC",
  "ETH",
  "XMR",
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
  // Summary endpoints
  // ---------------------------------------------------------------------------

  const cryptoUrl =
    `/api/crypto/summary?currency=${currencyParam}`;

  const metalsUrl =
    `/api/metals/summary?base=gold&currency=${currencyParam}`;

  // ---------------------------------------------------------------------------
  // Load summaries and charts
  // ---------------------------------------------------------------------------

  const [
    cryptoSummary,
    metalsSummary,
    cryptoCharts,
  ] = await Promise.all([
    fetchJson<CryptoSummary>(
      cryptoUrl
    ),

    fetchJson<MetalsSummary>(
      metalsUrl
    ),

    fetchCryptoCharts(
      currency,
      DEFAULT_CHART_DAYS
    ),
  ]);

  // ---------------------------------------------------------------------------
  // Return complete market dataset
  // ---------------------------------------------------------------------------

  return {
    cryptoSummary,
    metalsSummary,
    cryptoCharts,
  };
}