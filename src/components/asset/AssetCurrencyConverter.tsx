"use client";

import { useState } from "react";
import styles from "./AssetPage.module.css";

/** Two-way spot-rate calculator. The field being edited is never reformatted. */
export default function AssetCurrencyConverter({
  symbol,
  currency,
  price,
}: {
  symbol: string;
  currency: string;
  price: number | null;
}) {
  const [edit, setEdit] = useState<{ side: "asset" | "fiat"; value: string }>({
    side: "asset",
    value: "1",
  });
  const validPrice = typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
  const entered = edit.value.trim() === "" ? null : Number(edit.value);
  const quantity = entered !== null && Number.isFinite(entered) && entered >= 0 ? entered : null;
  const assetAmount = quantity === null ? null : edit.side === "asset" ? quantity : validPrice ? quantity / validPrice : null;
  const fiatAmount = quantity === null ? null : edit.side === "fiat" ? quantity : validPrice ? quantity * validPrice : null;
  const format = (value: number | null, precision: number) =>
    value === null || !Number.isFinite(value) ? "" : new Intl.NumberFormat("en-US", {
      useGrouping: false,
      maximumFractionDigits: precision,
    }).format(value);

  return (
    <section className={styles.detailSection} aria-label={`${symbol} and ${currency} currency calculator`}>
      <div className={styles.detailSectionHeader}><h3>{symbol} / {currency} converter</h3><span>Indicative rate</span></div>
      <div className={styles.converterFields}>
        <label className={styles.converterLine}>
          <span>{symbol}</span>
          <input type="number" inputMode="decimal" min="0" step="any"
            value={edit.side === "asset" ? edit.value : format(assetAmount, 8)}
            onChange={(event) => setEdit({ side: "asset", value: event.target.value })}
            aria-label={`Amount in ${symbol}`} placeholder={validPrice === null ? "Price unavailable" : "0"} />
        </label>
        <label className={styles.converterLine}>
          <span>{currency}</span>
          <input type="number" inputMode="decimal" min="0" step="any"
            value={edit.side === "fiat" ? edit.value : format(fiatAmount, fiatAmount !== null && Math.abs(fiatAmount) < 1 ? 8 : 2)}
            onChange={(event) => setEdit({ side: "fiat", value: event.target.value })}
            aria-label={`Amount in ${currency}`} placeholder={validPrice === null ? "Price unavailable" : "0"} />
        </label>
      </div>
      <p className={styles.converterHint}>
        {validPrice === null
          ? "Waiting for a valid market price."
          : `1 ${symbol} = ${new Intl.NumberFormat(undefined, { style: "currency", currency, maximumFractionDigits: 2 }).format(validPrice)} · indicative market rate`}
      </p>
    </section>
  );
}
