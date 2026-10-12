import useSWR from "swr";
import { fetcher } from "./fetcher";

export const useCoinStats = (type: CoinType) => {
  const defaultResponse: CoinStats = {
    priceUsd: null,
    change24h: null,
    change24hPct: null,
  };

  const url = `/api/crypto/${type}`;

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
