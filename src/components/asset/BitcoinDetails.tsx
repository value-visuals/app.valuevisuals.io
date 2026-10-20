"use client";

import { useState } from "react";
import useSWR from "swr";
import { useCurrency } from "@/components/Currency";
import { useMarketStore } from "@/stores/marketStore";
import styles from "./AssetPage.module.css";

type BitcoinFundamentals = {
  currency: "USD" | "EUR" | "GBP";
  rank: number | null;
  high24h: number | null;
  low24h: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  allTimeHigh: number | null;
  allTimeHighDate: string | null;
  allTimeLow: number | null;
  allTimeLowDate: string | null;
};

type BitcoinNetwork = {
  source: "mempool.space";
  hashRateHs: number | null;
  difficulty: number | null;
  blockHeight: number | null;
  historicalUptimePct: number;
};

type Unit = "btc" | "sats" | "fiat";
type Edit = { unit: Unit; value: string };
const SATS_PER_BTC = 100_000_000;

async function fetcher<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Bitcoin metrics unavailable (${response.status})`);
  return response.json() as Promise<T>;
}

function amount(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatInput(value: number | null, decimals: number): string {
  if (value === null || !Number.isFinite(value)) return "";
  return new Intl.NumberFormat("en-US", {
    useGrouping: false,
    maximumFractionDigits: decimals,
  }).format(value);
}

function money(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const precision = Math.abs(value) >= 1 ? 2 : Math.abs(value) >= 0.01 ? 5 : 8;
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: value >= 1 ? 2 : 0,
    maximumFractionDigits: precision,
  }).format(value);
}

function shortCount(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value);
}

function dateLabel(value: string | null | undefined): string {
  if (!value) return "Date unavailable";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "Date unavailable";
}

function changeSince(reference: number | null, current: number | null): string {
  if (reference === null || reference <= 0 || current === null || current <= 0) return "—";
  const delta = ((current / reference) - 1) * 100;
  return `${delta > 0 ? "+" : ""}${new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(delta)}%`;
}

/** A compact two-way converter; its active field is never overwritten when the price updates. */
function Converter({
  unit,
  currency,
  price,
  initialValue,
}: {
  unit: "btc" | "sats";
  currency: string;
  price: number | null;
  initialValue: string;
}) {
  const [edit, setEdit] = useState<Edit>({ unit, value: initialValue });
  const parsed = amount(edit.value);
  const fiatPerUnit = price === null ? null : unit === "btc" ? price : price / SATS_PER_BTC;
  const assetValue = parsed === null
    ? null
    : edit.unit === unit
      ? parsed
      : fiatPerUnit === null || fiatPerUnit <= 0
        ? null
        : parsed / fiatPerUnit;
  const fiatValue = parsed === null
    ? null
    : edit.unit === "fiat"
      ? parsed
      : fiatPerUnit === null
        ? null
        : parsed * fiatPerUnit;

  const assetText = edit.unit === unit ? edit.value : formatInput(assetValue, unit === "btc" ? 8 : 0);
  const fiatText = edit.unit === "fiat" ? edit.value : formatInput(fiatValue, fiatValue !== null && fiatValue < 1 ? 8 : 2);
  const assetName = unit === "btc" ? "BTC" : "sats";

  return (
    <div className={styles.converterGroup}>
      <h3>{assetName} / {currency} converter</h3>
      <div className={styles.converterFields}>
        <label className={styles.converterLine}>
          <span>{assetName}</span>
          <input
            type="number"
            min="0"
            step={unit === "btc" ? "0.00000001" : "1"}
            inputMode="decimal"
            value={assetText}
            placeholder={price === null ? "Price unavailable" : "0"}
            onChange={(event) => setEdit({ unit, value: event.target.value })}
            aria-label={`Amount in ${assetName}`}
          />
        </label>
        <label className={styles.converterLine}>
          <span>{currency}</span>
          <input
            type="number"
            min="0"
            step="any"
            inputMode="decimal"
            value={fiatText}
            placeholder={price === null ? "Price unavailable" : "0"}
            onChange={(event) => setEdit({ unit: "fiat", value: event.target.value })}
            aria-label={`Amount in ${currency} for ${assetName}`}
          />
        </label>
      </div>
    </div>
  );
}

export default function BitcoinDetails() {
  const { currency } = useCurrency();
  const currencyKey = currency.toLowerCase() as "usd" | "eur" | "gbp";
  const price = useMarketStore((state) => state.cryptoSummary?.bitcoin?.[currencyKey] ?? null);
  const validPrice = typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;

  const { data: fundamentals, error: fundamentalsError } = useSWR<BitcoinFundamentals>(
    `/api/public/asset-fundamentals?asset=bitcoin&currency=${currency}`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, keepPreviousData: false },
  );
  const { data: network, error: networkError } = useSWR<BitcoinNetwork>(
    "/api/public/bitcoin-network",
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false },
  );

  const low = fundamentals?.low24h ?? null;
  const high = fundamentals?.high24h ?? null;
  const percentWithinRange = validPrice !== null && low !== null && high !== null && high > low
    ? Math.max(0, Math.min(100, ((validPrice - low) / (high - low)) * 100))
    : null;
  const hashrate = network?.hashRateHs && network.hashRateHs > 0
    ? `${(network.hashRateHs / 1e18).toLocaleString(undefined, { maximumFractionDigits: 1 })} EH/s`
    : "—";
  const satsPerCurrency = validPrice !== null
    ? Math.round(SATS_PER_BTC / validPrice).toLocaleString()
    : "—";

  return (
    <div className={styles.bitcoinDetails}>
      <div className={styles.bitcoinSideHead}>
        <div><span className={styles.kicker}>BITCOIN / BTC</span><h2>Market details</h2></div>
        <span className={styles.bitcoinSideTag}>Live price</span>
      </div>

      <section className={styles.bitcoinSideSection} aria-label="Bitcoin currency converters">
        <Converter unit="btc" currency={currency} price={validPrice} initialValue="1" />
        <Converter unit="sats" currency={currency} price={validPrice} initialValue="1000" />
        <p className={styles.converterHint}>
          1 {currency} ≈ {satsPerCurrency} sats · 1 BTC = 100,000,000 sats
        </p>
      </section>

      <section className={styles.bitcoinSideSection} aria-label="Bitcoin price performance">
        <div className={styles.bitcoinSectionHead}>
          <h3>Price performance</h3>
          <span>24 hours</span>
        </div>
        <div className={styles.highLowValues}>
          <div><span>Low</span><strong>{money(low, currency)}</strong></div>
          <div className={styles.alignRight}><span>High</span><strong>{money(high, currency)}</strong></div>
        </div>
        <div className={styles.rangeTrack} aria-label="Current Bitcoin price between 24-hour low and high" role="img">
          {percentWithinRange !== null && <span style={{ left: `${percentWithinRange}%` }} />}
        </div>
        <dl className={styles.bitcoinHistory}>
          <div>
            <dt>All-time high <small>{dateLabel(fundamentals?.allTimeHighDate)}</small></dt>
            <dd><strong>{money(fundamentals?.allTimeHigh ?? null, currency)}</strong><small>{changeSince(fundamentals?.allTimeHigh ?? null, validPrice)}</small></dd>
          </div>
          <div>
            <dt>All-time low <small>{dateLabel(fundamentals?.allTimeLowDate)}</small></dt>
            <dd><strong>{money(fundamentals?.allTimeLow ?? null, currency)}</strong><small>{changeSince(fundamentals?.allTimeLow ?? null, validPrice)}</small></dd>
          </div>
        </dl>
        {fundamentalsError && <p className={styles.bitcoinDataError}>CoinGecko price history is temporarily unavailable.</p>}
      </section>

      <section className={styles.bitcoinSideSection} aria-label="Bitcoin network statistics">
        <div className={styles.bitcoinSectionHead}>
          <h3>Bitcoin network</h3>
          <span>mempool.space</span>
        </div>
        <dl className={styles.bitcoinNetworkStats}>
          <div><dt>Hash rate <small>Network estimate</small></dt><dd>{hashrate}</dd></div>
          <div><dt>Uptime <small>Historical estimate since 2009</small></dt><dd>{network?.historicalUptimePct == null ? "—" : `${network.historicalUptimePct.toFixed(3)}%`}</dd></div>
          <div><dt>Block height</dt><dd>{network?.blockHeight == null ? "—" : network.blockHeight.toLocaleString()}</dd></div>
          <div><dt>Circulating supply</dt><dd>{shortCount(fundamentals?.circulatingSupply ?? null)} BTC</dd></div>
        </dl>
        <p className={styles.bitcoinNote}>
          Uptime is estimated from documented 2010 and 2013 network incidents, not from live node monitoring. Hash rate is an estimate from <a href="https://mempool.space" target="_blank" rel="noopener noreferrer">mempool.space</a>.
        </p>
        {networkError && <p className={styles.bitcoinDataError}>Network figures are temporarily unavailable.</p>}
      </section>
    </div>
  );
}
