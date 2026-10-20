export type MarketAssetId = "bitcoin" | "ethereum" | "monero" | "gold" | "silver";
export type MarketQuoteCurrency = "USD" | "EUR" | "GBP";
export type MarketAsset = {
  id: MarketAssetId;
  name: string;
  symbol: string;
  category: "Crypto" | "Metals";
  price: number | null;
  change24h: number | null;
  change7d: number | null;
  marketCap: number | null;
  volume24h: number | null;
  sparkline: number[];
  source: string;
};
export type PublicMarkets = {
  currency: MarketQuoteCurrency;
  updatedAt: string;
  assets: MarketAsset[];
  sentiment: { value: number; label: string } | null;
  stale?: boolean;
};

export const ASSETS: Pick<MarketAsset, "id" | "name" | "symbol" | "category">[] = [
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", category: "Crypto" },
  { id: "ethereum", name: "Ethereum", symbol: "ETH", category: "Crypto" },
  { id: "monero", name: "Monero", symbol: "XMR", category: "Crypto" },
  { id: "gold", name: "Gold", symbol: "XAU", category: "Metals" },
  { id: "silver", name: "Silver", symbol: "XAG", category: "Metals" },
];

export function parseMarketCurrency(value: string | null): MarketQuoteCurrency {
  const currency = String(value ?? "USD").toUpperCase();
  return currency === "EUR" || currency === "GBP" ? currency : "USD";
}
