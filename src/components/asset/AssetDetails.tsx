"use client";

import useSWR from "swr";
import { useCurrency } from "@/components/Currency";
import styles from "./AssetPage.module.css";

type CryptoAsset = "bitcoin" | "ethereum" | "monero";
type Fundamentals = {
  source: "coingecko";
  currency: "USD" | "EUR" | "GBP";
  updatedAt: string | null;
  rank: number | null;
  high24h: number | null;
  low24h: number | null;
  circulatingSupply: number | null;
  maxSupply: number | null;
  allTimeHigh: number | null;
};

const fetcher = async (url: string): Promise<Fundamentals> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Supplemental metrics unavailable (${response.status})`);
  return response.json();
};

function formatMoney(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency", currency,
    maximumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value);
}

function formatSupply(value: number | null, symbol: string) {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value)} ${symbol}`;
}

export function DisplayCurrency() {
  const { currency } = useCurrency();
  return <div className={styles.currencyDisplay}><span className={styles.currencyDot} /> PRICES IN {currency}</div>;
}

export default function AssetDetails({ asset }: { asset: CryptoAsset }) {
  const { currency } = useCurrency();
  const url = `/api/public/asset-fundamentals?asset=${asset}&currency=${currency}`;
  const { data, error, isLoading } = useSWR<Fundamentals>(url, fetcher, {
    refreshInterval: 300_000,
    revalidateOnFocus: false,
    keepPreviousData: false,
  });
  const symbol = { bitcoin: "BTC", ethereum: "ETH", monero: "XMR" }[asset];

  return (
    <div className={styles.fundamentals}>
      <div className={styles.fundamentalsHead}>
        <span className={styles.kicker}>ADDITIONAL METRICS</span>
        <span className={styles.muted}>CoinGecko</span>
      </div>
      {error ? (
        <p className={styles.dataNotice}>Additional data is temporarily unavailable. Core prices and charts are unaffected.</p>
      ) : isLoading && !data ? (
        <p className={styles.dataNotice}>Loading supplementary metrics…</p>
      ) : data ? (
        <dl className={styles.factList}>
          <div><dt>Market cap rank</dt><dd>{data.rank == null ? "—" : `#${data.rank}`}</dd></div>
          <div><dt>24h high</dt><dd>{formatMoney(data.high24h, currency)}</dd></div>
          <div><dt>24h low</dt><dd>{formatMoney(data.low24h, currency)}</dd></div>
          <div><dt>Circulating supply</dt><dd>{formatSupply(data.circulatingSupply, symbol)}</dd></div>
          <div><dt>Max supply</dt><dd>{formatSupply(data.maxSupply, symbol)}</dd></div>
          <div><dt>All-time high</dt><dd>{formatMoney(data.allTimeHigh, currency)}</dd></div>
        </dl>
      ) : null}
      <p className={styles.sourceFootnote}>Supplemental data only. Value Visuals remains the primary price/chart source.</p>
    </div>
  );
}
