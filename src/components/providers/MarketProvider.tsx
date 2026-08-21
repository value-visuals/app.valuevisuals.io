// src/components/providers/MarketProvider.tsx

"use client";

import React from "react";

import {
  useMarketStore,
  type MarketCurrency,
} from "@/stores/marketStore";

import { loadMarketData } from "@/lib/market/loadMarketData";

type MarketProviderProps = {
  children: React.ReactNode;
};

const REFRESH_INTERVAL = 60_000;

export default function MarketProvider({
  children,
}: MarketProviderProps) {
  const currency = useMarketStore(
    (state) => state.currency
  );

  const setCryptoSummary =
    useMarketStore(
      (state) => state.setCryptoSummary
    );

  const setMetalsSummary =
    useMarketStore(
      (state) => state.setMetalsSummary
    );

  const setCryptoLoading =
    useMarketStore(
      (state) => state.setCryptoLoading
    );

  const setMetalsLoading =
    useMarketStore(
      (state) => state.setMetalsLoading
    );

  const setCryptoError =
    useMarketStore(
      (state) => state.setCryptoError
    );

  const setMetalsError =
    useMarketStore(
      (state) => state.setMetalsError
    );

  const requestIdRef =
    React.useRef(0);

  const load = React.useCallback(
    async (
      currencyToLoad: MarketCurrency,
      showLoading = true
    ) => {
      const requestId =
        ++requestIdRef.current;

      if (showLoading) {
        setCryptoLoading(true);
        setMetalsLoading(true);
      }

      setCryptoError(null);
      setMetalsError(null);

      try {
        const data =
          await loadMarketData(
            currencyToLoad
          );

        /*
         * Ignore an older request if a newer
         * request has already started.
         */
        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        setCryptoSummary(
          data.cryptoSummary
        );

        setMetalsSummary(
          data.metalsSummary
        );
      } catch (error) {
        if (
          requestId !==
          requestIdRef.current
        ) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load market data.";

        console.error(
          "[MarketProvider]",
          error
        );

        setCryptoError(message);
        setMetalsError(message);
      } finally {
        if (
          requestId ===
          requestIdRef.current
        ) {
          setCryptoLoading(false);
          setMetalsLoading(false);
        }
      }
    },
    [
      setCryptoSummary,
      setMetalsSummary,
      setCryptoLoading,
      setMetalsLoading,
      setCryptoError,
      setMetalsError,
    ]
  );

  /*
   * Load whenever currency changes.
   */
  React.useEffect(() => {
    load(currency, true);
  }, [currency, load]);

  /*
   * Refresh periodically.
   *
   * This refreshes the existing store data
   * instead of making every component fetch
   * independently.
   */
  React.useEffect(() => {
    const interval =
      window.setInterval(() => {
        load(currency, false);
      }, REFRESH_INTERVAL);

    return () => {
      window.clearInterval(interval);
    };
  }, [currency, load]);

  /*
   * Refresh when the user comes back
   * to the browser tab.
   */
  React.useEffect(() => {
    const handleVisibility =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          load(currency, false);
        }
      };

    document.addEventListener(
      "visibilitychange",
      handleVisibility
    );

    return () => {
      document.removeEventListener(
        "visibilitychange",
        handleVisibility
      );
    };
  }, [currency, load]);

  return (
    <>
      {children}
    </>
  );
}