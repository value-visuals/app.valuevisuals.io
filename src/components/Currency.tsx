"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

type Currency = "USD" | "EUR" | "GBP";
const DEFAULT: Currency = "USD";

type Ctx = {
  currency: Currency;
  setCurrency: (c: Currency) => void;
};

const CurrencyContext = createContext<Ctx | null>(null);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<Currency>(DEFAULT);

  // restore from URL (?cur=EUR) or localStorage
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = (url.searchParams.get("cur") || "").toUpperCase();
    const fromStorage = localStorage.getItem("currency") || "";
    const pick = (["USD","EUR","GBP"] as Currency[]).find(c => c === (fromUrl as Currency))
      || (["USD","EUR","GBP"] as Currency[]).find(c => c === (fromStorage as Currency))
      || DEFAULT;
    setCurrency(pick);
  }, []);

  // write to URL + localStorage when changed
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("cur", currency);
    window.history.replaceState({}, "", url.toString());
    localStorage.setItem("currency", currency);
  }, [currency]);

  const value = useMemo(() => ({ currency, setCurrency }), [currency]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used within <CurrencyProvider>");
  return ctx;
}

export function CurrencyToggle({ className = "" }: { className?: string }) {
  const { currency, setCurrency } = useCurrency();
  const options: Currency[] = ["USD", "EUR", "GBP"];

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="inline-flex rounded-lg border border-border p-1 bg-muted/60 shadow-sm">
        {options.map((c) => {
          const active = c === currency;
          return (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              aria-pressed={active}
              className={[
                "h-8 px-3 text-xs font-medium rounded-md transition-colors",
                active
                  ? "bg-white text-foreground shadow-sm border border-border dark:text-black"
                  : "bg-transparent text-muted-foreground hover:bg-muted/70",
              ].join(" ")}
            >
              {c}
            </button>
          );
        })}
      </div>
    </div>
  );
}
