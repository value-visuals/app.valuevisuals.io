"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { fetchCryptoMarketData, fetchMetalsSummary } from "@/lib/market/loadMarketData";
import { useMarketStore, type MarketCurrency } from "@/stores/marketStore";

const REFRESH_INTERVAL = 60_000;
const describe = (cause: unknown) => cause instanceof Error ? cause.message : "Market data is temporarily unavailable.";

/** Keep the existing Firestore-backed market data contract and SWR charts.
 * Crypto and metal summaries resolve independently, so a temporary provider
 * error can no longer blank the entire signed-in dashboard.
 */
export default function MarketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid ?? null;
  const currency = useMarketStore(s => s.currency);
  const setCryptoSummary = useMarketStore(s => s.setCryptoSummary);
  const setMetalsSummary = useMarketStore(s => s.setMetalsSummary);
  const setBitcoinStats = useMarketStore(s => s.setBitcoinStats);
  const setEthereumStats = useMarketStore(s => s.setEthereumStats);
  const setMoneroStats = useMarketStore(s => s.setMoneroStats);
  const setCryptoLoading = useMarketStore(s => s.setCryptoLoading);
  const setMetalsLoading = useMarketStore(s => s.setMetalsLoading);
  const setCryptoError = useMarketStore(s => s.setCryptoError);
  const setMetalsError = useMarketStore(s => s.setMetalsError);
  const requestRef = useRef(0);
  // Zustand survives route navigation. Preserve same-user, same-currency quotes.
  const currencyRef = useRef<MarketCurrency>(currency);
  const userRef = useRef<string | null>(userId);

  const load = useCallback(async (requested: MarketCurrency, force = false) => {
    const request = ++requestRef.current;
    const switchedCurrency = currencyRef.current !== requested;
    const switchedUser = userRef.current !== userId;
    currencyRef.current = requested;
    userRef.current = userId;
    const existing = useMarketStore.getState();
    // Avoid clearing and refetching a recent snapshot when navigating back to Analysis.
    if (!force && !switchedCurrency && !switchedUser &&
        existing.cryptoSummary && existing.metalsSummary &&
        existing.lastCryptoUpdate && existing.lastMetalsUpdate &&
        Date.now() - Math.min(existing.lastCryptoUpdate, existing.lastMetalsUpdate) < 30_000) {
      return;
    }
    if (switchedCurrency || switchedUser) {
      // Do not display a USD quote under a newly chosen EUR/GBP label.
      setCryptoSummary(null);
      setMetalsSummary(null);
      setBitcoinStats(null);
      setEthereumStats(null);
      setMoneroStats(null);
    }
    setCryptoLoading(true);
    setMetalsLoading(true);
    setCryptoError(null);
    setMetalsError(null);

    await Promise.allSettled([
      fetchCryptoMarketData(requested).then(data => {
        if (request !== requestRef.current) return;
        setCryptoSummary(data.cryptoSummary);
        setBitcoinStats(data.bitcoinStats);
        setEthereumStats(data.ethereumStats);
        setMoneroStats(data.moneroStats);
      }).catch(cause => {
        if (request === requestRef.current) setCryptoError(describe(cause));
      }).finally(() => {
        if (request === requestRef.current) setCryptoLoading(false);
      }),
      fetchMetalsSummary(requested).then(data => {
        if (request === requestRef.current) setMetalsSummary(data);
      }).catch(cause => {
        if (request === requestRef.current) setMetalsError(describe(cause));
      }).finally(() => {
        if (request === requestRef.current) setMetalsLoading(false);
      }),
    ]);
  }, [userId, setCryptoSummary, setMetalsSummary, setBitcoinStats, setEthereumStats, setMoneroStats, setCryptoLoading, setMetalsLoading, setCryptoError, setMetalsError]);

  useEffect(() => {
    void load(currency);
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(currency);
    }, REFRESH_INTERVAL);
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void load(currency);
    };
    const forceRefresh = () => { void load(currency, true); };
    document.addEventListener("visibilitychange", refreshVisible);
    document.addEventListener("valuevisuals:refresh-markets", forceRefresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refreshVisible);
      document.removeEventListener("valuevisuals:refresh-markets", forceRefresh);
      requestRef.current++;
    };
  }, [currency, userId, load]);

  return <>{children}</>;
}
