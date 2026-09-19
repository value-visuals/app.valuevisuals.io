"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  type MarketCurrency,
  useMarketStore,
} from "@/stores/marketStore";

export type Currency = "USD" | "EUR" | "GBP";

const DEFAULT: Currency = "USD";

const SUPPORTED_CURRENCIES: readonly Currency[] = [
  "USD",
  "EUR",
  "GBP",
];

type Ctx = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
};

const CurrencyContext =
  createContext<Ctx | null>(null);

function parseCurrency(
  value: string | null | undefined
): Currency | null {
  if (!value) {
    return null;
  }

  const normalized =
    value.trim().toUpperCase();

  if (
    SUPPORTED_CURRENCIES.includes(
      normalized as Currency
    )
  ) {
    return normalized as Currency;
  }

  return null;
}

function toMarketCurrency(
  currency: Currency
): MarketCurrency {
  return currency.toLowerCase() as MarketCurrency;
}

function toDisplayCurrency(
  currency: MarketCurrency
): Currency {
  return currency.toUpperCase() as Currency;
}

export function CurrencyProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const marketCurrency =
    useMarketStore(
      (state) => state.currency
    );

  const setMarketCurrency =
    useMarketStore(
      (state) => state.setCurrency
    );

  /*
   * Prevent the initial default USD value from being
   * written to localStorage / URL before we've had a
   * chance to restore the user's previous currency.
   */
  const [initialized, setInitialized] =
    useState(false);

  const currency =
    toDisplayCurrency(marketCurrency);

  const setCurrency =
    useCallback(
      (nextCurrency: Currency) => {
        setMarketCurrency(
          toMarketCurrency(nextCurrency)
        );
      },
      [setMarketCurrency]
    );

  /*
   * Initial currency priority:
   *
   * 1. URL ?cur=
   * 2. localStorage
   * 3. USD
   */
  useEffect(() => {
    let nextCurrency: Currency =
      DEFAULT;

    try {
      const url =
        new URL(window.location.href);

      const fromUrl =
        parseCurrency(
          url.searchParams.get("cur")
        );

      let fromStorage:
        | Currency
        | null = null;

      try {
        fromStorage =
          parseCurrency(
            window.localStorage.getItem(
              "currency"
            )
          );
      } catch {
        // localStorage may be unavailable
        // in restricted browser environments.
      }

      nextCurrency =
        fromUrl ??
        fromStorage ??
        DEFAULT;
    } catch {
      nextCurrency = DEFAULT;
    }

    setMarketCurrency(
      toMarketCurrency(nextCurrency)
    );

    setInitialized(true);
  }, [setMarketCurrency]);

  /*
   * Keep URL and localStorage synchronized with the
   * canonical Zustand currency.
   */
  useEffect(() => {
    if (!initialized) {
      return;
    }

    try {
      const url =
        new URL(window.location.href);

      if (
        url.searchParams.get("cur") !==
        currency
      ) {
        url.searchParams.set(
          "cur",
          currency
        );

        /*
         * Preserve Next.js / browser history state
         * instead of replacing it with an empty object.
         */
        window.history.replaceState(
          window.history.state,
          "",
          `${url.pathname}${url.search}${url.hash}`
        );
      }
    } catch {
      // URL synchronization is non-critical.
    }

    try {
      if (
        window.localStorage.getItem(
          "currency"
        ) !== currency
      ) {
        window.localStorage.setItem(
          "currency",
          currency
        );
      }
    } catch {
      // localStorage synchronization is non-critical.
    }
  }, [currency, initialized]);

  const value =
    useMemo(
      () => ({
        currency,
        setCurrency,
      }),
      [currency, setCurrency]
    );

  return (
    <CurrencyContext.Provider
      value={value}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const ctx =
    useContext(CurrencyContext);

  if (!ctx) {
    throw new Error(
      "useCurrency must be used within <CurrencyProvider>"
    );
  }

  return ctx;
}

export function CurrencyToggle({
  className = "",
  currencies = SUPPORTED_CURRENCIES,
}: {
  className?: string;
  currencies?: readonly Currency[];
}) {
  const {
    currency,
    setCurrency,
  } = useCurrency();

  const availableCurrencies =
    currencies.length > 0
      ? currencies
      : SUPPORTED_CURRENCIES;

  /*
   * Preserve the existing behavior where a toggle
   * restricted to a subset corrects an unsupported
   * current currency.
   */
  useEffect(() => {
    if (
      !availableCurrencies.includes(
        currency
      )
    ) {
      setCurrency(
        availableCurrencies[0]
      );
    }
  }, [
    currency,
    availableCurrencies,
    setCurrency,
  ]);

  return (
    <div
      className={`inline-flex items-center gap-2 ${className}`}
    >
      <div className="inline-flex rounded-lg border border-border p-1 bg-muted/60 shadow-sm">
        {availableCurrencies.map(
          (candidate) => {
            const active =
              candidate === currency;

            return (
              <button
                key={candidate}
                type="button"
                onClick={() =>
                  setCurrency(
                    candidate
                  )
                }
                aria-pressed={
                  active
                }
                aria-label={`Display prices in ${candidate}`}
                className={[
                  "h-8 px-3 text-xs font-medium rounded-md transition-colors",
                  active
                    ? "bg-white text-foreground shadow-sm border border-border dark:text-black"
                    : "bg-transparent text-muted-foreground hover:bg-muted/70",
                ].join(" ")}
              >
                {candidate}
              </button>
            );
          }
        )}
      </div>
    </div>
  );
}