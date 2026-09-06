// src/components/providers/MarketProvider.tsx

"use client";

import React from "react";

import {
  useMarketStore,
  type MarketCurrency,
} from "@/stores/marketStore";

import { loadMarketData } from "@/lib/market/loadMarketData";
import Loading from "@/app/(dashboard)/dashboard/loading";

type MarketProviderProps = {
  children: React.ReactNode;
};

const REFRESH_INTERVAL = 60_000;

export default function MarketProvider({ children }: MarketProviderProps) {
  const currency = useMarketStore((state) => state.currency);

  const setCryptoSummary = useMarketStore((state) => state.setCryptoSummary);
  const setMetalsSummary = useMarketStore((state) => state.setMetalsSummary);
  const setCryptoLoading = useMarketStore((state) => state.setCryptoLoading);
  const setMetalsLoading = useMarketStore((state) => state.setMetalsLoading);
  const setCryptoError = useMarketStore((state) => state.setCryptoError);
  const setMetalsError = useMarketStore((state) => state.setMetalsError);

  /*
   * Controls the full-screen dashboard loader.
   *
   * This is separate from the individual crypto/metals loading states
   * in the store. The dashboard remains covered by Loading until the
   * initial market dataset has finished loading.
   */
  const [initialLoading, setInitialLoading] = React.useState(true);

  const requestIdRef = React.useRef(0);

  const load = React.useCallback(
    async (currencyToLoad: MarketCurrency, showLoading = true) => {
      const requestId = ++requestIdRef.current;

      /*
       * Only show the full-screen loader for the initial load
       * and currency changes. Background refreshes continue silently.
       */
      if (showLoading) {
        setInitialLoading(true);
        setCryptoLoading(true);
        setMetalsLoading(true);
      }

      setCryptoError(null);
      setMetalsError(null);

      try {
        /*
         * loadMarketData() does not resolve until all required market
         * data has completed loading.
         */
        const data = await loadMarketData(currencyToLoad);

        /*
         * Ignore an older request if a newer request has already started.
         */
        if (requestId !== requestIdRef.current) return;

        setCryptoSummary(data.cryptoSummary);
        setMetalsSummary(data.metalsSummary);
      } catch (error) {
        if (requestId !== requestIdRef.current) return;

        const message =
          error instanceof Error
            ? error.message
            : "Unable to load market data.";

        console.error("[MarketProvider]", error);

        setCryptoError(message);
        setMetalsError(message);
      } finally {
        if (requestId !== requestIdRef.current) return;

        setCryptoLoading(false);
        setMetalsLoading(false);

        /*
         * Background refreshes never affect the full-screen loader.
         */
        if (showLoading) setInitialLoading(false);
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
   * Load whenever the currency changes.
   *
   * Currency changes intentionally show the full-screen loader because
   * all market data needs to be reloaded in the new currency.
   */
  React.useEffect(() => {
    load(currency, true);
  }, [currency, load]);

  /*
   * Refresh periodically without blocking the existing dashboard UI.
   */
  React.useEffect(() => {
    const interval = window.setInterval(() => {
      load(currency, false);
    }, REFRESH_INTERVAL);

    return () => window.clearInterval(interval);
  }, [currency, load]);

  /*
   * Refresh when the user returns to the browser tab.
   *
   * This is intentionally a silent background refresh.
   */
  React.useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        load(currency, false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [currency, load]);

  return (
    <>
      {initialLoading && <Loading />}
      {children}
    </>
  );
}
