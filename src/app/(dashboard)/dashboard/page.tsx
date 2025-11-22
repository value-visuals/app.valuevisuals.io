import TopTiles from "@/components/toptiles/TopTiles";
import PriceChart from "@/components/charts/PriceChart";
import MetalsChart from "@/components/charts/MetalsChart";
import { CurrencyProvider, CurrencyToggle } from "@/components/Currency";
import { ChartNoAxesCombined } from "lucide-react";

export default function DashboardPage() {
  return (
    <CurrencyProvider>
      <main className="space-y-6 mx-auto max-w-7xl" role="main" aria-label="Dashboard overview">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <ChartNoAxesCombined aria-hidden="true" className="size-5" />
            <span>Dashboard</span>
          </h1>
          <CurrencyToggle />
        </div>

        {/* KPIs */}
        <section aria-labelledby="kpi-heading">
          <TopTiles />
        </section>

        {/* Crypto */}
        <section aria-labelledby="crypto-heading" className="space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <PriceChart coin="bitcoin" className="w-full" />
            <PriceChart coin="ethereum" className="w-full" />
          </div>
        </section>

        {/* Metals */}
        <section aria-labelledby="metals-heading" className="space-y-3">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <MetalsChart metal="gold" className="w-full" />
            <MetalsChart metal="silver" className="w-full" />
          </div>
        </section>
      </main>
    </CurrencyProvider>
  );
}
