"use client";

import useSWR from "swr";
import { useCurrency } from "@/components/Currency";
import { useMarketStore } from "@/stores/marketStore";
import styles from "./AssetPage.module.css";
import AssetCurrencyConverter from "./AssetCurrencyConverter";

type CryptoAsset = "ethereum" | "monero";
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

function money(value: number | null, currency: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency", currency, maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(value);
}

function supply(value: number | null, symbol: string): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 2 }).format(value)} ${symbol}`;
}

export function DisplayCurrency() {
  const { currency } = useCurrency();
  return <div className={styles.currencyDisplay}><span className={styles.currencyDot} /> PRICES IN {currency}</div>;
}

export default function AssetDetails({ asset }: { asset: CryptoAsset }) {
  const { currency } = useCurrency();
  const key = currency.toLowerCase() as "usd" | "eur" | "gbp";
  const latest = useMarketStore((state) => state.cryptoSummary?.[asset]?.[key] ?? null);
  const price = typeof latest === "number" && Number.isFinite(latest) && latest > 0 ? latest : null;
  const { data, error, isLoading } = useSWR<Fundamentals>(
    `/api/public/asset-fundamentals?asset=${asset}&currency=${currency}`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false, keepPreviousData: false },
  );
  const symbol = asset === "ethereum" ? "ETH" : "XMR";
  const high = data?.high24h ?? null;
  const low = data?.low24h ?? null;
  const rangePosition = price !== null && low !== null && high !== null && high > low
    ? Math.max(0, Math.min(100, (price - low) / (high - low) * 100)) : null;

  return (
    <div className={styles.fundamentals}>
      <div className={styles.detailHeader}>
        <div><span className={styles.kicker}>{symbol} / MARKET DATA</span><h2>Market details</h2></div>
        <span className={styles.detailPill}>CoinGecko</span>
      </div>
      <AssetCurrencyConverter symbol={symbol} currency={currency} price={price} />
      <section className={styles.detailSection} aria-label={`${symbol} 24-hour price range`}>
        <div className={styles.detailSectionHeader}><h3>24h price range</h3><span>{currency}</span></div>
        <div className={styles.rangeLabels}>
          <div><span>Low</span><strong>{money(low, currency)}</strong></div>
          <div className={styles.alignRight}><span>High</span><strong>{money(high, currency)}</strong></div>
        </div>
        <div className={styles.rangeTrack} role="img" aria-label="Current market price within the 24-hour price range">
          {rangePosition !== null && <span style={{ left: `${rangePosition}%` }} />}
        </div>
      </section>
      <section className={styles.detailSection} aria-label={`${symbol} fundamentals`}>
        <div className={styles.detailSectionHeader}><h3>Fundamentals</h3><span>Market snapshot</span></div>
        {error && <p className={styles.dataNotice}>Supplemental data is temporarily unavailable. Live prices and charts are unaffected.</p>}
        {isLoading && !data && !error && <p className={styles.dataNotice}>Loading market details…</p>}
        <dl className={styles.factList}>
          <div><dt>Market cap rank</dt><dd>{data?.rank == null ? "—" : `#${data.rank}`}</dd></div>
          <div><dt>Circulating supply</dt><dd>{supply(data?.circulatingSupply ?? null, symbol)}</dd></div>
          <div><dt>Max supply</dt><dd>{supply(data?.maxSupply ?? null, symbol)}</dd></div>
          <div><dt>All-time high</dt><dd>{money(data?.allTimeHigh ?? null, currency)}</dd></div>
        </dl>
      </section>
      <p className={styles.detailNote}>Supplemental data is sourced from CoinGecko. Value Visuals remains the primary source for market prices and historical charts.</p>
    </div>
  );
}
