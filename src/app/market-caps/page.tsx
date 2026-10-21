import type { Metadata } from "next";
import MarketCapRanking from "@/components/marketcap/MarketCapRanking";

export const metadata: Metadata = {
  title: "Top 100 Assets by Market Cap | Value Visuals",
  description: "Compare the top 100 global assets by market capitalization across companies, commodities, currencies and cryptocurrencies.",
};

export default function MarketCapsPage() {
  return (
    <main className="enterprise-main vv-top100-page" aria-label="Global asset market capitalization rankings">
      <div className="enterprise-breadcrumb vv-top100-breadcrumb">
        MARKETS <span>/</span> GLOBAL ASSETS
      </div>
      <h1 className="sr-only">Top 100 assets by market capitalization</h1>
      <MarketCapRanking />
    </main>
  );
}
