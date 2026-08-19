// src/lib/market/loadMarketData.ts

import type {
  CryptoSummary,
  MetalsSummary,
  MarketCurrency,
} from "@/stores/marketStore";

import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";

type LoadResult = {
  cryptoSummary: CryptoSummary;
  metalsSummary: MetalsSummary;
};

async function fetchJson<T>(
  url: string
): Promise<T> {
  const response = await authenticatedFetch(url);

  if (!response.ok) {
    const body = await response
      .json()
      .catch(() => ({}));

    const error = new Error(
      body?.error ||
        `Request failed: ${response.status} ${response.statusText}`
    );

    /*
     * Preserve backend auth information for later handling.
     */
    (error as any).status = response.status;
    (error as any).code = body?.code;

    throw error;
  }

  return response.json();
}

export async function loadMarketData(
  currency: MarketCurrency
): Promise<LoadResult> {
  const currencyParam =
    encodeURIComponent(currency);

  const cryptoUrl =
    `/api/crypto/summary?currency=${currencyParam}`;

  const metalsUrl =
    `/api/metals/summary?base=gold&currency=${currencyParam}`;

  const [
    cryptoSummary,
    metalsSummary,
  ] = await Promise.all([
    fetchJson<CryptoSummary>(cryptoUrl),
    fetchJson<MetalsSummary>(metalsUrl),
  ]);

  return {
    cryptoSummary,
    metalsSummary,
  };
}