import TopTiles from "@/components/toptiles/TopTiles";
import PriceChart from "@/components/charts/PriceChart";
import MetalsChart from "@/components/charts/MetalsChart";
import {
  CurrencyProvider,
  CurrencyToggle,
} from "@/components/Currency";
import { ChartNoAxesCombined } from "lucide-react";
import CryptoComparisonChart from "@/components/charts/CompareChart";
import MarketProvider from "@/components/providers/MarketProvider";

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

        {/* Crypto */}
        <section
          aria-labelledby="crypto-heading"
          className="min-w-0 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2
              id="crypto-heading"
              className="
                text-base
                font-semibold
                tracking-tight
                sm:text-lg
              "
            >
              Cryptocurrency
            </h2>
          </div>

          <div
            className="
              grid
              min-w-0
              grid-cols-1
              gap-4
              sm:gap-5
              lg:grid-cols-2
              lg:gap-6
            "
          >
            <PriceChart
              coin="bitcoin"
              className="
                min-w-0
                w-full
                sm:w-full
                max-sm:-mx-1
                max-sm:w-[calc(100%+0.5rem)]
              "
            />

            <PriceChart
              coin="ethereum"
              className="
                min-w-0
                w-full
                sm:w-full
                max-sm:-mx-1
                max-sm:w-[calc(100%+0.5rem)]
              "
            />
          </div>
        </section>

        {/* Metals */}
        <section
          aria-labelledby="metals-heading"
          className="min-w-0 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2
              id="metals-heading"
              className="
                text-base
                font-semibold
                tracking-tight
                sm:text-lg
              "
            >
              Precious Metals
            </h2>
          </div>

          <div
            className="
              grid
              min-w-0
              grid-cols-1
              gap-4
              sm:gap-5
              lg:grid-cols-2
              lg:gap-6
            "
          >
            <MetalsChart
              metal="gold"
              className="
                min-w-0
                w-full
                sm:w-full
                max-sm:-mx-1
                max-sm:w-[calc(100%+0.5rem)]
              "
            />

            <MetalsChart
              metal="silver"
              className="
                min-w-0
                w-full
                sm:w-full
                max-sm:-mx-1
                max-sm:w-[calc(100%+0.5rem)]
              "
            />
          </div>
        </section>
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