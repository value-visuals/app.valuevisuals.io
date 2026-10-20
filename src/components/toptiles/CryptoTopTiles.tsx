"use client";

import { useEffect } from "react";
import { useCurrency } from "@/components/Currency";
import { useMarketStore, type CoinStats } from "@/stores/marketStore";
import TopTile from "./TopTile";

type CryptoAsset = "bitcoin" | "ethereum" | "monero";
type Props = { asset: CryptoAsset; className?: string };

type SummaryStats = {
  marketCap?: number | null;
  volume24h?: number | null;
  change24h?: number | null;
  change24hPct?: number | null;
  dominancePct?: number | null;
};

const SYMBOL: Record<CryptoAsset, string> = {
  bitcoin: "BTC", ethereum: "ETH", monero: "XMR",
};

function money(value: number | null | undefined, currency: string, compact = false): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency", currency,
    ...(compact ? { notation: "compact" as const, maximumFractionDigits: 2 } : { maximumFractionDigits: 2 }),
  }).format(value);
}

function percent(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(2)}%`;
}

function changeFraction(stats: CoinStats | null): number | null {
  if (!stats) return null;
  return stats.change24h ?? (stats.change24hPct != null ? stats.change24hPct / 100 : null);
}

export default function CryptoTopTiles({ asset, className = "" }: Props) {
  const { currency } = useCurrency();
  const marketCurrency = currency.toLowerCase() as "usd" | "eur" | "gbp";
  const cryptoSummary = useMarketStore((state) => state.cryptoSummary);
  const cryptoError = useMarketStore((state) => state.cryptoError);
  const fetchMarketData = useMarketStore((state) => state.fetchMarketData);
  const stats = useMarketStore((state) => asset === "bitcoin" ? state.bitcoinStats : asset === "ethereum" ? state.ethereumStats : state.moneroStats);
  const fetchStats = useMarketStore((state) => asset === "bitcoin" ? state.fetchBitcoinStats : asset === "ethereum" ? state.fetchEthereumStats : state.fetchMoneroStats);

  useEffect(() => { void fetchMarketData(marketCurrency); }, [fetchMarketData, marketCurrency]);
  useEffect(() => { if (!stats) void fetchStats(); }, [fetchStats, stats]);

  // Prices, market cap and trading volume come from the same currency-aware summary
  // used elsewhere in the application. CoinGecko supplemental data never replaces them.
  const price = cryptoSummary?.[asset]?.[marketCurrency];
  const summaryStats = cryptoSummary?.[`${asset}_stats`] as SummaryStats | undefined;
  const cap = summaryStats?.marketCap ?? null;
  const volume = summaryStats?.volume24h ?? null;
  const change = summaryStats?.change24h ?? changeFraction(stats);
  const dominance = summaryStats?.dominancePct ?? stats?.dominancePct ?? null;
  const error = Boolean(cryptoError);

  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>
      <TopTile label={`${SYMBOL[asset]} price`} value={money(price, currency)} change={change} error={error} />
      <TopTile label="Market capitalization" value={money(cap, currency, true)} fullValue={money(cap, currency)} error={error} />
      <TopTile label="24h trading volume" value={money(volume, currency, true)} fullValue={money(volume, currency)} error={error} />
      <TopTile label="Market dominance" value={percent(dominance)} error={error} />
    </div>
  );
}
