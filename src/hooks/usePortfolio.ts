import useSWR from "swr";
import { fetcher } from "./fetcher";

export const usePortfolioSummary = (type: CoinType) => {
  const defaultResponse: SummaryResponse = {
    totals: { balance: 0, totalReceived: 0, totalSent: 0, pendingDelta: 0 },
    wallets: [],
  };

  const url = `/api/crypto/portfolio/${type}?view=summary`;

  const { data, error, isLoading } = useSWR(url, fetcher, {
    fallbackData: defaultResponse,
    revalidateOnFocus: true, // check data on focus
  });

  console.log(data);

  return {
    data: data,
    error,
    isLoading,
  };
};

export const usePortfolioChart = (type: CoinType) => {
  const defaultResponse: ChartResponse = {
    range: "",
    points: [],
  };

  const url = `/api/crypto/portfolio/${type}?view=chart&range=30d`;

  const { data, error, isLoading } = useSWR(url, fetcher, {
    fallbackData: defaultResponse,
    revalidateOnFocus: true, // check data on focus
  });

  return {
    data: data,
    error,
    isLoading,
  };
};
