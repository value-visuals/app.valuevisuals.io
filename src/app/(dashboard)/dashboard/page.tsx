import TopTiles from "@/components/toptiles/TopTiles";
import {
  CurrencyProvider,
  CurrencyToggle,
} from "@/components/Currency";
import { ChartNoAxesCombined } from "lucide-react";
import CryptoComparisonChart from "@/components/charts/CompareChart";
import MarketProvider from "@/components/providers/MarketProvider";
import MarketList from "@/components/market/MarketList";

export default function DashboardPage() {
  return (
    <CurrencyProvider>
      <MarketProvider>
        <main
          className="
            mx-auto
            w-full
            max-w-7xl
            px-2
            sm:px-4
            lg:px-6
            xl:px-0
            space-y-6
            sm:space-y-7
            lg:space-y-8
          "
          role="main"
          aria-label="Dashboard overview"
        >
          {/* Header */}
          <header
            className="
              flex
              items-center
              justify-between
              gap-3
            "
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <ChartNoAxesCombined
                aria-hidden="true"
                className="size-5 shrink-0 sm:size-6"
              />

              <h1
                className="
                  min-w-0
                  truncate
                  text-lg
                  font-semibold
                  tracking-tight
                  sm:text-xl
                "
              >
                Dashboard
              </h1>
            </div>

            <div className="shrink-0">
              <CurrencyToggle />
            </div>
          </header>

          {/* KPIs */}
          <section
            aria-labelledby="kpi-heading"
            className="min-w-0"
          >
            <h2
              id="kpi-heading"
              className="sr-only"
            >
              Market overview
            </h2>

            <TopTiles />
          </section>

          {/* Market List */}
          <MarketList />

          {/* Crypto Comparison */}
          <div className="space-y-6">
            <CryptoComparisonChart
              initialBase="bitcoin"
              initialQuote="ethereum"
            />
          </div>
        </main>
      </MarketProvider>
    </CurrencyProvider>
  );
}
