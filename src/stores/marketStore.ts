// src/stores/marketStore.ts

import { create } from "zustand";
import { loadMarketData } from "@/lib/market/loadMarketData";
import { authenticatedFetch } from "@/lib/auth/authenticatedFetch";

export type MarketCurrency =
  | "usd"
  | "eur"
  | "gbp";

export type CoinStats = {
  priceUsd?: number | null;
  change24hPct?: number | null;
  change24h?: number | null;
  marketCapUsd?: number | null;
  volume24hUsd?: number | null;
  dominancePct?: number | null;
};

export type CryptoAssetSummary = {
  [currency: string]:
    | number
    | null
    | undefined;
};

export type CryptoAssetStats = {
  price?: number | null;
  change24hPct?: number | null;
  change24h?: number | null;
  change7dPct?: number | null;
  marketCap?: number | null;
  volume24h?: number | null;
  dominancePct?: number | null;
};

export type CryptoSummary = {
  bitcoin?: CryptoAssetSummary;
  ethereum?: CryptoAssetSummary;
  monero?: CryptoAssetSummary;

  bitcoin_stats?: CryptoAssetStats;
  ethereum_stats?: CryptoAssetStats;
  monero_stats?: CryptoAssetStats;

  global_market_cap?: CryptoAssetSummary;

  [key: string]: unknown;
};

export type MetalsSummaryItem = {
  symbol?: string;
  name?: string;
  price?: number | null;
  currency?: string;
  change?: number | null;
  percentChange?: number | null;
  change24h?: number | null;
  change24hPct?: number | null;
  change7dPct?: number | null;
  open?: number | null;
  high?: number | null;
  low?: number | null;
  previousClose?: number | null;
  datetime?: string;
  provider?: string;
  source?: string;

  [key: string]: unknown;
};

export type MetalsSummary = {
  items?: MetalsSummaryItem[];
  price?: number | null;

  [key: string]: unknown;
};

export type MetalAsset =
  | "gold"
  | "silver";

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

  setCurrency: (
    currency: MarketCurrency
  ) => void;

  fetchMarketData: (
    currency?: MarketCurrency
  ) => Promise<void>;

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
    value: boolean
  ) => void;

  setMetalsLoading: (
    value: boolean
  ) => void;

  setBitcoinLoading: (
    value: boolean
  ) => void;

  setEthereumLoading: (
    value: boolean
  ) => void;

  setMoneroLoading: (
    value: boolean
  ) => void;

  setGoldLoading: (
    value: boolean
  ) => void;

  setSilverLoading: (
    value: boolean
  ) => void;

  setCryptoError: (
    value: string | null
  ) => void;

  setMetalsError: (
    value: string | null
  ) => void;

  setBitcoinError: (
    value: string | null
  ) => void;

  setEthereumError: (
    value: string | null
  ) => void;

  setMoneroError: (
    value: string | null
  ) => void;

  setGoldError: (
    value: string | null
  ) => void;

  setSilverError: (
    value: string | null
  ) => void;

  fetchBitcoinStats: (
    currency?: MarketCurrency
  ) => Promise<void>;

  fetchEthereumStats: (
    currency?: MarketCurrency
  ) => Promise<void>;

  fetchMoneroStats: (
    currency?: MarketCurrency
  ) => Promise<void>;

  fetchMetal: (
    asset: MetalAsset,
    currency?: MarketCurrency
  ) => Promise<void>;

  resetMarket: () => void;
};

const METAL_SYMBOLS: Record<
  MetalAsset,
  string
> = {
  gold: "XAU",
  silver: "XAG",
};

const normalizeCurrency = (
  currency: MarketCurrency
) =>
  currency.toUpperCase();

async function fetchStats(
  endpoint: string,
  currency: MarketCurrency
): Promise<CoinStats> {
  const url =
    `${endpoint}${
      endpoint.includes("?")
        ? "&"
        : "?"
    }currency=${encodeURIComponent(
      currency
    )}`;

  const res =
    await authenticatedFetch(url);

  if (!res.ok) {
    const body =
      await res
        .json()
        .catch(() => ({}));

    const error = new Error(
      body?.error ||
        `Request failed: ${res.status} ${res.statusText}`
    );

    Object.assign(error, {
      status: res.status,
      code: body?.code,
    });

    throw error;
  }

  return res.json();
}

async function fetchMetalSummary(
  asset: MetalAsset,
  currency: MarketCurrency
): Promise<MetalSummary> {
  const symbol =
    METAL_SYMBOLS[asset];

  const requestedCurrency =
    normalizeCurrency(currency);

  const url =
    `/api/metals/summary?metal=${asset}&currency=${requestedCurrency}`;

  const res =
    await authenticatedFetch(url);

  if (!res.ok) {
    const body =
      await res
        .json()
        .catch(() => ({}));

    const error = new Error(
      body?.error ||
        `Failed to fetch ${asset} data`
    );

    Object.assign(error, {
      status: res.status,
      code: body?.code,
      url,
    });

    throw error;
  }

  const data =
    await res.json();

  const expected =
    `${symbol}/${requestedCurrency}`;

  const item = (
    Array.isArray(data?.items)
      ? data.items
      : []
  ).find(
    (entry: MetalsSummaryItem) =>
      String(
        entry?.symbol || ""
      ).toUpperCase() === expected ||
      (
        String(
          entry?.name || ""
        ).toLowerCase() === asset &&
        String(
          entry?.currency || ""
        ).toUpperCase() ===
          requestedCurrency
      )
  );

  if (!item) {
    throw new Error(
      `No ${asset} data returned for ${requestedCurrency}`
    );
  }

  const num = (
    value: unknown
  ) => {
    const number =
      Number(value);

    return Number.isFinite(
      number
    )
      ? number
      : null;
  };

  const parsed =
    item.datetime
      ? Date.parse(
          item.datetime
        )
      : NaN;

  return {
    metal: asset,
    symbol,
    base: String(
      item.currency ||
        requestedCurrency
    ).toUpperCase(),

    price: num(item.price),

    change24h: num(
      item.change
    ),

    changePct24h: num(
      item.percentChange
    ),

    high24h: num(
      item.high
    ),

    low24h: num(
      item.low
    ),

    at: Number.isFinite(
      parsed
    )
      ? parsed
      : Date.now(),

    source:
      item.provider != null
        ? String(
            item.provider
          )
        : item.source != null
          ? String(
              item.source
            )
          : "Firebase",
  };
}

/*
 * Normalize the crypto stats returned by loadMarketData() into the
 * CoinStats shape used throughout the application.
 *
 * The backend summary uses:
 *   price
 *   marketCap
 *   volume24h
 *
 * while CoinStats uses:
 *   priceUsd
 *   marketCapUsd
 *   volume24hUsd
 *
 * Keep both forms supported so the store remains compatible with the
 * existing loader and API response shapes.
 */
function normalizeCoinStats(
  stats:
    | CoinStats
    | CryptoAssetStats
    | null
    | undefined
): CoinStats | null {
  if (!stats) {
    return null;
  }

  const source =
    stats as CoinStats &
      CryptoAssetStats;

  return {
    priceUsd:
      Number.isFinite(
        Number(source.priceUsd)
      )
        ? Number(source.priceUsd)
        : Number.isFinite(
            Number(source.price)
          )
          ? Number(source.price)
          : null,

    change24hPct:
      Number.isFinite(
        Number(source.change24hPct)
      )
        ? Number(
            source.change24hPct
          )
        : null,

    change24h:
      Number.isFinite(
        Number(source.change24h)
      )
        ? Number(
            source.change24h
          )
        : null,

    marketCapUsd:
      Number.isFinite(
        Number(source.marketCapUsd)
      )
        ? Number(
            source.marketCapUsd
          )
        : Number.isFinite(
            Number(source.marketCap)
          )
          ? Number(
              source.marketCap
            )
          : null,

    volume24hUsd:
      Number.isFinite(
        Number(source.volume24hUsd)
      )
        ? Number(
            source.volume24hUsd
          )
        : Number.isFinite(
            Number(source.volume24h)
          )
          ? Number(
              source.volume24h
            )
          : null,

    dominancePct:
      Number.isFinite(
        Number(source.dominancePct)
      )
        ? Number(
            source.dominancePct
          )
        : null,
  };
}

const initialState = {
  currency:
    "usd" as MarketCurrency,

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
};

export const useMarketStore =
  create<MarketState>(
    (set, get) => {
      let marketId = 0;

      const requestIds = {
        bitcoin: 0,
        ethereum: 0,
        monero: 0,
        gold: 0,
        silver: 0,
      };

      const setValue = (
        key: string,
        value: unknown
      ) =>
        set({
          [key]: value,
        } as Partial<MarketState>);

      const setWithTimestamp =
        (
          dataKey: string,
          timeKey: string
        ) =>
        (data: unknown) =>
          set({
            [dataKey]: data,
            [timeKey]: Date.now(),
          } as Partial<MarketState>);

      const setFlag =
        (key: string) =>
        (value: boolean) =>
          setValue(
            key,
            value
          );

      const setError =
        (key: string) =>
        (
          value: string | null
        ) =>
          setValue(
            key,
            value
          );

      const fetchCoin =
        async (
          asset:
            | "bitcoin"
            | "ethereum"
            | "monero",
          endpoint: string,
          fallback: string,
          currency?: MarketCurrency
        ) => {
          const requested =
            currency ??
            get().currency;

          const id =
            ++requestIds[
              asset
            ];

          const prefix =
            asset;

          set({
            currency: requested,

            [`${prefix}Loading`]:
              true,

            [`${prefix}Error`]:
              null,
          } as Partial<MarketState>);

          try {
            const data =
              await fetchStats(
                endpoint,
                requested
              );

            if (
              id !==
              requestIds[
                asset
              ]
            ) {
              return;
            }

            set({
              [`${prefix}Stats`]:
                normalizeCoinStats(
                  data
                ),

              [`${prefix}Loading`]:
                false,

              [`${prefix}Error`]:
                null,

              [`last${
                asset[0].toUpperCase()
              }${asset.slice(1)}Update`]:
                Date.now(),
            } as Partial<MarketState>);
          } catch (
            error
          ) {
            if (
              id !==
              requestIds[
                asset
              ]
            ) {
              return;
            }

            console.error(
              `[marketStore] ${asset} request failed:`,
              error
            );

            set({
              [`${prefix}Loading`]:
                false,

              [`${prefix}Error`]:
                error instanceof
                Error
                  ? error.message
                  : fallback,
            } as Partial<MarketState>);
          }
        };

      return {
        ...initialState,

        setCurrency:
          (currency) =>
            set({
              currency,
            }),

        fetchMarketData:
          async (
            currency
          ) => {
            const requested =
              currency ??
              get().currency;

            const id =
              ++marketId;

            set({
              currency:
                requested,

              cryptoLoading:
                true,

              metalsLoading:
                true,

              cryptoError:
                null,

              metalsError:
                null,
            });

            try {
              /*
               * Keep the existing loadMarketData() behavior intact.
               * It continues loading crypto summaries, individual crypto
               * stats, metals, and charts.
               */
              const data =
                await loadMarketData(
                  requested
                );

              if (
                id !== marketId
              ) {
                return;
              }

              /*
               * Normalize the individual crypto stats before putting
               * them into the dedicated store fields consumed by
               * CryptoTopTiles.
               */
              const bitcoinStats =
                normalizeCoinStats(
                  data.bitcoinStats
                );

              const ethereumStats =
                normalizeCoinStats(
                  data.ethereumStats
                );

              const moneroStats =
                normalizeCoinStats(
                  data.moneroStats
                );

              /*
               * Preserve the existing crypto summary while ensuring
               * MarketList has the stats it expects.
               *
               * The dedicated CoinStats fields are also preserved
               * separately for CryptoTopTiles and other consumers.
               */
              const cryptoSummary: CryptoSummary =
                {
                  ...data.cryptoSummary,

                  bitcoin_stats:
                    data.cryptoSummary
                      ?.bitcoin_stats ??
                    (
                      bitcoinStats
                        ? {
                            price:
                              bitcoinStats.priceUsd,
                            change24hPct:
                              bitcoinStats.change24hPct,
                            change24h:
                              bitcoinStats.change24h,
                            marketCap:
                              bitcoinStats.marketCapUsd,
                            volume24h:
                              bitcoinStats.volume24hUsd,
                            dominancePct:
                              bitcoinStats.dominancePct,
                          }
                        : undefined
                    ),

                  ethereum_stats:
                    data.cryptoSummary
                      ?.ethereum_stats ??
                    (
                      ethereumStats
                        ? {
                            price:
                              ethereumStats.priceUsd,
                            change24hPct:
                              ethereumStats.change24hPct,
                            change24h:
                              ethereumStats.change24h,
                            marketCap:
                              ethereumStats.marketCapUsd,
                            volume24h:
                              ethereumStats.volume24hUsd,
                            dominancePct:
                              ethereumStats.dominancePct,
                          }
                        : undefined
                    ),

                  monero_stats:
                    data.cryptoSummary
                      ?.monero_stats ??
                    (
                      moneroStats
                        ? {
                            price:
                              moneroStats.priceUsd,
                            change24hPct:
                              moneroStats.change24hPct,
                            change24h:
                              moneroStats.change24h,
                            marketCap:
                              moneroStats.marketCapUsd,
                            volume24h:
                              moneroStats.volume24hUsd,
                            dominancePct:
                              moneroStats.dominancePct,
                          }
                        : undefined
                    ),
                };

              set({
                /*
                 * These are the fields CryptoTopTiles already expects.
                 * This is the critical fix.
                 */
                bitcoinStats,

                ethereumStats,

                moneroStats,

                /*
                 * Keep the normalized summary for MarketList and
                 * existing summary consumers.
                 */
                cryptoSummary,

                metalsSummary:
                  data.metalsSummary,

                cryptoLoading:
                  false,

                metalsLoading:
                  false,

                cryptoError:
                  null,

                metalsError:
                  null,

                lastCryptoUpdate:
                  Date.now(),

                lastMetalsUpdate:
                  Date.now(),

                lastBitcoinUpdate:
                  Date.now(),

                lastEthereumUpdate:
                  Date.now(),

                lastMoneroUpdate:
                  Date.now(),
              });
            } catch (
              error
            ) {
              if (
                id !== marketId
              ) {
                return;
              }

              const message =
                error instanceof
                Error
                  ? error.message
                  : "Failed to load market data";

              set({
                cryptoLoading:
                  false,

                metalsLoading:
                  false,

                cryptoError:
                  message,

                metalsError:
                  message,
              });
            }
          },

        setCryptoSummary:
          setWithTimestamp(
            "cryptoSummary",
            "lastCryptoUpdate"
          ),

        setMetalsSummary:
          setWithTimestamp(
            "metalsSummary",
            "lastMetalsUpdate"
          ),

        setBitcoinStats:
          setWithTimestamp(
            "bitcoinStats",
            "lastBitcoinUpdate"
          ),

        setEthereumStats:
          setWithTimestamp(
            "ethereumStats",
            "lastEthereumUpdate"
          ),

        setMoneroStats:
          setWithTimestamp(
            "moneroStats",
            "lastMoneroUpdate"
          ),

        setCryptoLoading:
          setFlag(
            "cryptoLoading"
          ),

        setMetalsLoading:
          setFlag(
            "metalsLoading"
          ),

        setBitcoinLoading:
          setFlag(
            "bitcoinLoading"
          ),

        setEthereumLoading:
          setFlag(
            "ethereumLoading"
          ),

        setMoneroLoading:
          setFlag(
            "moneroLoading"
          ),

        setGoldLoading:
          setFlag(
            "goldLoading"
          ),

        setSilverLoading:
          setFlag(
            "silverLoading"
          ),

        setCryptoError:
          setError(
            "cryptoError"
          ),

        setMetalsError:
          setError(
            "metalsError"
          ),

        setBitcoinError:
          setError(
            "bitcoinError"
          ),

        setEthereumError:
          setError(
            "ethereumError"
          ),

        setMoneroError:
          setError(
            "moneroError"
          ),

        setGoldError:
          setError(
            "goldError"
          ),

        setSilverError:
          setError(
            "silverError"
          ),

        fetchBitcoinStats:
          (currency) =>
            fetchCoin(
              "bitcoin",
              "/api/crypto/bitcoin",
              "Failed to load BTC data",
              currency
            ),

        fetchEthereumStats:
          (currency) =>
            fetchCoin(
              "ethereum",
              "/api/crypto/ethereum",
              "Failed to load ETH data",
              currency
            ),

        fetchMoneroStats:
          (currency) =>
            fetchCoin(
              "monero",
              "/api/crypto/monero",
              "Failed to load XMR data",
              currency
            ),

        fetchMetal:
          async (
            asset,
            currency
          ) => {
            const requested =
              currency ??
              get().currency;

            const id =
              ++requestIds[
                asset
              ];

            const prefix =
              asset;

            const label =
              asset[0].toUpperCase() +
              asset.slice(1);

            set({
              currency:
                requested,

              [`${prefix}Loading`]:
                true,

              [`${prefix}Error`]:
                null,
            } as Partial<MarketState>);

            try {
              const data =
                await fetchMetalSummary(
                  asset,
                  requested
                );

              if (
                id !==
                requestIds[
                  asset
                ]
              ) {
                return;
              }

              set({
                [`${prefix}Summary`]:
                  data,

                [`${prefix}Loading`]:
                  false,

                [`${prefix}Error`]:
                  null,

                [`last${label}Update`]:
                  Date.now(),
              } as Partial<MarketState>);
            } catch (
              error
            ) {
              if (
                id !==
                requestIds[
                  asset
                ]
              ) {
                return;
              }

              console.error(
                `[marketStore] ${asset} request failed:`,
                error
              );

              set({
                [`${prefix}Loading`]:
                  false,

                [`${prefix}Error`]:
                  error instanceof
                  Error
                    ? error.message
                    : `Failed to load ${asset} data`,
              } as Partial<MarketState>);
            }
          },

        resetMarket:
          () => {
            marketId++;

            Object.keys(
              requestIds
            ).forEach(
              (key) =>
                ++requestIds[
                  key as keyof typeof requestIds
                ]
            );

            set(initialState);
          },
      };
    }
  );
