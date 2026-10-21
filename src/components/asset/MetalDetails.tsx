"use client";

import { useState } from "react";
import { useCurrency } from "@/components/Currency";
import { useMarketStore } from "@/stores/marketStore";
import { toTroyOunces } from "@/lib/portfolio/metals";
import styles from "./AssetPage.module.css";

type MetalAsset = "gold" | "silver";
type WeightUnit = "ozt" | "g" | "kg" | "lb";

const WEIGHT_UNITS: { value: WeightUnit; label: string }[] = [
  { value: "ozt", label: "troy oz" },
  { value: "g", label: "grams" },
  { value: "kg", label: "kg" },
  { value: "lb", label: "lb" },
];

function money(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency", currency,
    minimumFractionDigits: 2, maximumFractionDigits: Math.abs(value) < 0.01 ? 8 : Math.abs(value) < 1 ? 4 : 2,
  }).format(value);
}

export default function MetalDetails({ asset }: { asset: MetalAsset }) {
  const { currency } = useCurrency();
  const summary = useMarketStore((state) => asset === "gold" ? state.goldSummary : state.silverSummary);
  const loading = useMarketStore((state) => asset === "gold" ? state.goldLoading : state.silverLoading);
  const error = useMarketStore((state) => asset === "gold" ? state.goldError : state.silverError);
  const activeSummary = summary?.base?.toUpperCase() === currency ? summary : null;
  const [weight, setWeight] = useState("1");
  const [unit, setUnit] = useState<WeightUnit>("ozt");
  const [fiatInput, setFiatInput] = useState("");
  const [editedField, setEditedField] = useState<"weight" | "fiat">("weight");

  const price = typeof activeSummary?.price === "number" && Number.isFinite(activeSummary.price) && activeSummary.price > 0
    ? activeSummary.price : null;
  const enteredWeight = weight.trim() === "" ? null : Number(weight);
  const enteredFiat = fiatInput.trim() === "" ? null : Number(fiatInput);
  const validWeight = enteredWeight !== null && Number.isFinite(enteredWeight) && enteredWeight >= 0;
  const validFiat = enteredFiat !== null && Number.isFinite(enteredFiat) && enteredFiat >= 0;
  const oztPerUnit = toTroyOunces(1, unit);
  const ounces = editedField === "weight"
    ? validWeight ? toTroyOunces(enteredWeight, unit) : null
    : validFiat && price !== null ? enteredFiat / price : null;
  const quantity = editedField === "weight" ? weight
    : ounces !== null ? String(Number((ounces / oztPerUnit).toPrecision(10))) : "";
  const valuation = editedField === "fiat"
    ? validFiat && price !== null ? enteredFiat : null
    : ounces !== null && price !== null ? ounces * price : null;
  const fiatValue = editedField === "fiat" ? fiatInput
    : valuation === null ? "" : valuation.toFixed(Math.abs(valuation) < 0.01 ? 8 : Math.abs(valuation) < 1 ? 4 : 2);
  const low = typeof activeSummary?.low24h === "number" && Number.isFinite(activeSummary.low24h) ? activeSummary.low24h : null;
  const high = typeof activeSummary?.high24h === "number" && Number.isFinite(activeSummary.high24h) ? activeSummary.high24h : null;
  const rangePosition = price !== null && low !== null && high !== null && high > low
    ? Math.max(0, Math.min(100, (price - low) / (high - low) * 100)) : null;

  return (
    <div className={styles.metalDetails}>
      <div className={styles.detailHeader}>
        <div><span className={styles.kicker}>SPOT MARKET / {asset === "gold" ? "XAU" : "XAG"}</span><h2>Market details</h2></div>
        <span className={styles.detailPill}>Per troy oz</span>
      </div>

      <section className={styles.detailSection} aria-label="Spot valuation calculator">
        <div className={styles.detailSectionHeader}><h3>Weight converter</h3><span>Indicative spot value</span></div>
        <div className={styles.weightInputs}>
          <label className={styles.weightField}>
            <span>Quantity</span>
            <input
              aria-label="Metal weight"
              type="number" inputMode="decimal" min="0" step="any"
              value={quantity} onChange={(event) => { setWeight(event.target.value); setEditedField("weight"); }}
              placeholder="0"
            />
          </label>
          <label className={styles.weightField}>
            <span>Unit</span>
            <select aria-label="Metal weight unit" value={unit} onChange={(event) => setUnit(event.target.value as WeightUnit)}>
              {WEIGHT_UNITS.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
            </select>
          </label>
        </div>
        <label className={`${styles.weightField} ${styles.fiatWeightField}`}>
          <span>Amount in {currency} · edit either amount</span>
          <input type="number" inputMode="decimal" min="0" step="any"
            aria-label={`Spot value in ${currency}`} value={fiatValue}
            placeholder={price === null ? "Spot price unavailable" : "0"}
            onChange={(event) => { setFiatInput(event.target.value); setEditedField("fiat"); }} />
        </label>
        <div className={styles.valuationResult} aria-live="polite">
          <span>Indicative spot value · {currency}</span>
          <strong>{money(valuation, currency)}</strong>
          <small>{ounces !== null ? `${ounces.toLocaleString(undefined, { maximumFractionDigits: 6 })} troy oz` : "Enter a non-negative amount when the spot price is available"}</small>
        </div>
        <p className={styles.converterHint}>Spot pricing excludes dealer premiums, fees and taxes. A plain oz in Value Visuals means troy oz; lb means standard pound.</p>
      </section>

      <section className={styles.detailSection} aria-label="Metal spot price range">
        <div className={styles.detailSectionHeader}><h3>24h price range</h3><span>{currency} / ozt</span></div>
        <div className={styles.rangeLabels}>
          <div><span>Low</span><strong>{money(low, currency)}</strong></div>
          <div className={styles.alignRight}><span>High</span><strong>{money(high, currency)}</strong></div>
        </div>
        <div className={styles.rangeTrack} role="img" aria-label="Spot price within 24-hour range">
          {rangePosition !== null && <span style={{ left: `${rangePosition}%` }} />}
        </div>
        <dl className={styles.factList}>
          <div><dt>Price / troy ounce</dt><dd>{money(price, currency)}</dd></div>
          <div><dt>Price / gram</dt><dd>{money(price !== null ? price / 31.1034768 : null, currency)}</dd></div>
          <div><dt>Market</dt><dd>Spot metal</dd></div>
          <div><dt>Estimated total market cap</dt><dd>Pending source</dd></div>
          <div><dt>Feed</dt><dd>{activeSummary?.source || "Value Visuals"}</dd></div>
        </dl>
        {error && <p className={styles.dataNotice}>Metal price data is temporarily unavailable.</p>}
        {!error && (loading || !activeSummary) && <p className={styles.dataNotice}>Loading spot prices…</p>}
      </section>
      <p className={styles.detailNote}>Estimated above-ground metal market cap will be displayed when the AssetMarketCap feed is integrated into the backend. It is not cryptocurrency circulating supply or crypto dominance.</p>
    </div>
  );
}
