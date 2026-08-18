// src/lib/market/loadMarketData.ts

import type {
  CryptoSummary,
  MetalsSummary,
  MarketCurrency,
} from "@/stores/marketStore";

type LoadResult = {
  cryptoSummary: CryptoSummary;
  metalsSummary: MetalsSummary;
};

async function fetchJson<T>(
  url: string
): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Request failed: ${response.status} ${response.statusText}`
    );
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