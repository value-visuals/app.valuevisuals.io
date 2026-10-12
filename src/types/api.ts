type Integerish = string | number; // backend may send bigint-as-string

type CoinType = "bitcoin" | "ethereum";

type CoinStats = {
  priceUsd?: number | null;
  change24h?: number | null; // fraction (e.g., 0.034)
  change24hPct?: number | null; // percent (e.g., 3.4)
};

type WalletStat = {
  address: string;
  totalReceived: Integerish; // sats or wei
  totalSent: Integerish;
  balance: Integerish;
  pendingDelta: Integerish;
  txCount: number;
};

type SummaryResponse = {
  totals: {
    balance: Integerish;
    totalReceived: Integerish;
    totalSent: Integerish;
    pendingDelta: Integerish;
  };
  wallets: WalletStat[];
};

type ChartPoint = { t: number | string; flow: Integerish; cum: Integerish };
type ChartResponse = { range: string; points: ChartPoint[]; note?: string };
