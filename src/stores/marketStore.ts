// src/stores/marketStore.ts

import { create } from "zustand";

import { loadMarketData } from "@/lib/market/loadMarketData";

export type MarketCurrency = "usd" | "eur" | "gbp";

export type CoinStats = {
  priceUsd?: number | null;
  change24hPct?: number | null;
  change24h?: number | null;
  marketCapUsd?: number | null;
  volume24hUsd?: number | null;
  dominancePct?: number | null;
};

export type CryptoSummary = {
  bitcoin?: Record<string, number>;
  ethereum?: Record<string, number>;
  monero?: Record<string, number>;
  global_market_cap?: Record<string, number>;
  [key: string]: unknown;
};

export type MetalsSummaryItem = {
  symbol?: string;
  name?: string;
  price?: number;
  currency?: string;
  change?: number | null;
  percentChange?: number | null;
  high?: number | null;
  low?: number | null;
  datetime?: string;
  [key: string]: unknown;
};

export type MetalsSummary = {
  items?: MetalsSummaryItem[];
  price?: number;
  [key: string]: unknown;
};

export type MetalAsset = "gold" | "silver";

export type MetalSummary = {
  metal: string;
  symbol: string;
  base: string;
  price: number | null;
  change24h: number | null;
  changePct24h: number | null;
  high24h: number | null;
  low24h: number | null;
  at: number | null;
  source: string | null;
};

type MarketState = {
  currency: MarketCurrency;

  cryptoSummary: CryptoSummary | null;
  metalsSummary: MetalsSummary | null;

  bitcoinStats: CoinStats | null;
  ethereumStats: CoinStats | null;
  moneroStats: CoinStats | null;

  goldSummary: MetalSummary | null;
  silverSummary: MetalSummary | null;

  cryptoLoading: boolean;
  metalsLoading: boolean;

  bitcoinLoading: boolean;
  ethereumLoading: boolean;
  moneroLoading: boolean;

  goldLoading: boolean;
  silverLoading: boolean;

  cryptoError: string | null;
  metalsError: string | null;

  bitcoinError: string | null;
  ethereumError: string | null;
  moneroError: string | null;

  goldError: string | null;
  silverError: string | null;

  lastCryptoUpdate: number | null;
  lastMetalsUpdate: number | null;

  lastBitcoinUpdate: number | null;
  lastEthereumUpdate: number | null;
  lastMoneroUpdate: number | null;

  lastGoldUpdate: number | null;
  lastSilverUpdate: number | null;

  setCurrency: (currency: MarketCurrency) => void;

  fetchMarketData: (currency?: MarketCurrency) => Promise<void>;

  setCryptoSummary: (
    data: CryptoSummary | null
  ) => void;

  setMetalsSummary: (
    data: MetalsSummary | null
  ) => void;

  setBitcoinStats: (
    data: CoinStats | null
  ) => void;

  setEthereumStats: (
    data: CoinStats | null
  ) => void;

  setMoneroStats: (
    data: CoinStats | null
  ) => void;

  setCryptoLoading: (
    loading: boolean
  ) => void;

  setMetalsLoading: (
    loading: boolean
  ) => void;

  setBitcoinLoading: (
    loading: boolean
  ) => void;

  setEthereumLoading: (
    loading: boolean
  ) => void;

  setMoneroLoading: (
    loading: boolean
  ) => void;

  setGoldLoading: (
    loading: boolean
  ) => void;

  setSilverLoading: (
    loading: boolean
  ) => void;

  setCryptoError: (
    error: string | null
  ) => void;

  setMetalsError: (
    error: string | null
  ) => void;

  setBitcoinError: (
    error: string | null
  ) => void;

  setEthereumError: (
    error: string | null
  ) => void;

  setMoneroError: (
    error: string | null
  ) => void;

  setGoldError: (
    error: string | null
  ) => void;

  setSilverError: (
    error: string | null
  ) => void;

  fetchBitcoinStats: () => Promise<void>;
  fetchEthereumStats: () => Promise<void>;
  fetchMoneroStats: () => Promise<void>;

  fetchMetal: (
    asset: MetalAsset
  ) => Promise<void>;

  resetMarket: () => void;
};

async function fetchCoinStats(
  endpoint: string
): Promise<CoinStats> {
  const res = await fetch(endpoint, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${endpoint}`
    );
  }

  return res.json();
}

async function fetchMetalSummary(
  asset: MetalAsset
): Promise<MetalSummary> {
  const res = await fetch(
    `/api/metals/summary?metal=${asset}`,
    {
      cache: "no-store",
      credentials: "include",
    }
  );

  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${asset} data`
    );
  }

  const data = await res.json();

  const symbol =
    asset === "gold" ? "XAU" : "XAG";

  const item =
    data &&
    Array.isArray(data.items)
      ? data.items.find(
          (it: MetalsSummaryItem) =>
            String(it?.symbol || "")
              .toUpperCase()
              .startsWith(`${symbol}/`) ||
            String(it?.name || "")
              .toLowerCase() === asset
        )
      : null;

  if (item) {
    return {
      metal: asset,
      symbol,
      base: String(
        item.currency || "USD"
      ),
      price:
        item.price != null
          ? Number(item.price)
          : null,
      change24h:
        item.change != null
          ? Number(item.change)
          : null,
      changePct24h:
        item.percentChange != null
          ? Number(item.percentChange)
          : null,
      high24h:
        item.high != null
          ? Number(item.high)
          : null,
      low24h:
        item.low != null
          ? Number(item.low)
          : null,
      at: item.datetime
        ? Date.parse(item.datetime)
        : Date.now(),
      source: "API Ninjas",
    };
  }

  if (
    data &&
    typeof data === "object" &&
    "price" in data
  ) {
    return {
      metal: asset,
      symbol,
      base: String(
        data.base || "USD"
      ),
      price:
        data.price != null
          ? Number(data.price)
          : null,
      change24h:
        data.change24h != null
          ? Number(data.change24h)
          : null,
      changePct24h:
        data.changePct24h != null
          ? Number(data.changePct24h)
          : null,
      high24h:
        data.high24h != null
          ? Number(data.high24h)
          : null,
      low24h:
        data.low24h != null
          ? Number(data.low24h)
          : null,
      at:
        data.at != null
          ? Number(data.at)
          : Date.now(),
      source:
        data.source ?? null,
    };
  }

  throw new Error(
    `No ${asset} data returned`
  );
}

export const useMarketStore =
  create<MarketState>((set, get) => {
    /*
     * Incremented for every market-summary request.
     *
     * This prevents an older request from overwriting
     * a newer currency selection if the user switches
     * currencies quickly.
     */
    let marketRequestId = 0;

    return {
      currency: "usd",

      cryptoSummary: null,
      metalsSummary: null,

      bitcoinStats: null,
      ethereumStats: null,
      moneroStats: null,

      goldSummary: null,
      silverSummary: null,

      cryptoLoading: false,
      metalsLoading: false,

      bitcoinLoading: false,
      ethereumLoading: false,
      moneroLoading: false,

      goldLoading: false,
      silverLoading: false,

      cryptoError: null,
      metalsError: null,

      bitcoinError: null,
      ethereumError: null,
      moneroError: null,

      goldError: null,
      silverError: null,

      lastCryptoUpdate: null,
      lastMetalsUpdate: null,

      lastBitcoinUpdate: null,
      lastEthereumUpdate: null,
      lastMoneroUpdate: null,

      lastGoldUpdate: null,
      lastSilverUpdate: null,

      setCurrency: (currency) =>
        set({
          currency,
        }),

      fetchMarketData: async (currency) => {
        const requestedCurrency =
          currency ?? get().currency;

        const requestId =
          ++marketRequestId;

        set({
          currency: requestedCurrency,
          cryptoLoading: true,
          metalsLoading: true,
          cryptoError: null,
          metalsError: null,
        });

        try {
          const {
            cryptoSummary,
            metalsSummary,
          } = await loadMarketData(
            requestedCurrency
          );

          /*
           * Ignore this response if another
           * market request started after it.
           */
          if (
            requestId !== marketRequestId
          ) {
            return;
          }

          set({
            cryptoSummary,
            metalsSummary,

            cryptoLoading: false,
            metalsLoading: false,

            cryptoError: null,
            metalsError: null,

            lastCryptoUpdate: Date.now(),
            lastMetalsUpdate: Date.now(),
          });
        } catch (error) {
          /*
           * Don't let an older failed request
           * overwrite the state of a newer request.
           */
          if (
            requestId !== marketRequestId
          ) {
            return;
          }

          console.error(error);

          const message =
            error instanceof Error
              ? error.message
              : "Failed to load market data";

          set({
            cryptoLoading: false,
            metalsLoading: false,
            cryptoError: message,
            metalsError: message,
          });
        }
      },

      setCryptoSummary: (data) =>
        set({
          cryptoSummary: data,
          lastCryptoUpdate: Date.now(),
        }),

      setMetalsSummary: (data) =>
        set({
          metalsSummary: data,
          lastMetalsUpdate: Date.now(),
        }),

      setBitcoinStats: (data) =>
        set({
          bitcoinStats: data,
          lastBitcoinUpdate: Date.now(),
        }),

      setEthereumStats: (data) =>
        set({
          ethereumStats: data,
          lastEthereumUpdate: Date.now(),
        }),

      setMoneroStats: (data) =>
        set({
          moneroStats: data,
          lastMoneroUpdate: Date.now(),
        }),

      setCryptoLoading: (loading) =>
        set({
          cryptoLoading: loading,
        }),

      setMetalsLoading: (loading) =>
        set({
          metalsLoading: loading,
        }),

      setBitcoinLoading: (loading) =>
        set({
          bitcoinLoading: loading,
        }),

      setEthereumLoading: (loading) =>
        set({
          ethereumLoading: loading,
        }),

      setMoneroLoading: (loading) =>
        set({
          moneroLoading: loading,
        }),

      setGoldLoading: (loading) =>
        set({
          goldLoading: loading,
        }),

      setSilverLoading: (loading) =>
        set({
          silverLoading: loading,
        }),

      setCryptoError: (error) =>
        set({
          cryptoError: error,
        }),

      setMetalsError: (error) =>
        set({
          metalsError: error,
        }),

      setBitcoinError: (error) =>
        set({
          bitcoinError: error,
        }),

      setEthereumError: (error) =>
        set({
          ethereumError: error,
        }),

      setMoneroError: (error) =>
        set({
          moneroError: error,
        }),

      setGoldError: (error) =>
        set({
          goldError: error,
        }),

      setSilverError: (error) =>
        set({
          silverError: error,
        }),

      fetchBitcoinStats: async () => {
        set({
          bitcoinLoading: true,
          bitcoinError: null,
        });

        try {
          const data =
            await fetchCoinStats(
              "/api/crypto/bitcoin"
            );

          set({
            bitcoinStats: data,
            bitcoinLoading: false,
            bitcoinError: null,
            lastBitcoinUpdate: Date.now(),
          });
        } catch (error) {
          console.error(error);

          set({
            bitcoinLoading: false,
            bitcoinError:
              "Failed to load BTC data",
          });
        }
      },

      fetchEthereumStats: async () => {
        set({
          ethereumLoading: true,
          ethereumError: null,
        });

        try {
          const data =
            await fetchCoinStats(
              "/api/crypto/ethereum"
            );

          set({
            ethereumStats: data,
            ethereumLoading: false,
            ethereumError: null,
            lastEthereumUpdate: Date.now(),
          });
        } catch (error) {
          console.error(error);

          set({
            ethereumLoading: false,
            ethereumError:
              "Failed to load ETH data",
          });
        }
      },

      fetchMoneroStats: async () => {
        set({
          moneroLoading: true,
          moneroError: null,
        });

        try {
          const data =
            await fetchCoinStats(
              "/api/crypto/monero"
            );

          set({
            moneroStats: data,
            moneroLoading: false,
            moneroError: null,
            lastMoneroUpdate: Date.now(),
          });
        } catch (error) {
          console.error(error);

          set({
            moneroLoading: false,
            moneroError:
              "Failed to load XMR data",
          });
        }
      },

      fetchMetal: async (asset) => {
        const isGold = asset === "gold";

        set(
          isGold
            ? {
                goldLoading: true,
                goldError: null,
              }
            : {
                silverLoading: true,
                silverError: null,
              }
        );

        try {
          const data =
            await fetchMetalSummary(asset);

          if (isGold) {
            set({
              goldSummary: data,
              goldLoading: false,
              goldError: null,
              lastGoldUpdate: Date.now(),
            });
          } else {
            set({
              silverSummary: data,
              silverLoading: false,
              silverError: null,
              lastSilverUpdate: Date.now(),
            });
          }
        } catch (error) {
          console.error(error);

          if (isGold) {
            set({
              goldLoading: false,
              goldError:
                "Failed to load gold data",
            });
          } else {
            set({
              silverLoading: false,
              silverError:
                "Failed to load silver data",
            });
          }
        }
      },

      resetMarket: () =>
        set({
          cryptoSummary: null,
          metalsSummary: null,

          bitcoinStats: null,
          ethereumStats: null,
          moneroStats: null,

          goldSummary: null,
          silverSummary: null,

          cryptoLoading: false,
          metalsLoading: false,

          bitcoinLoading: false,
          ethereumLoading: false,
          moneroLoading: false,

          goldLoading: false,
          silverLoading: false,

          cryptoError: null,
          metalsError: null,

          bitcoinError: null,
          ethereumError: null,
          moneroError: null,

          goldError: null,
          silverError: null,

          lastCryptoUpdate: null,
          lastMetalsUpdate: null,

          lastBitcoinUpdate: null,
          lastEthereumUpdate: null,
          lastMoneroUpdate: null,

          lastGoldUpdate: null,
          lastSilverUpdate: null,
        }),
    };
});