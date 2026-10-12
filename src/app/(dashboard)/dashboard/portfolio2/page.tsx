"use client";
import Link from "next/link";
import PortfolioChart from "@/components/charts/PortfolioChart";
import PageTitle from "@/components/ui/PageTitle";
import { useState } from "react";
import ViewSwitcher from "@/components/ui/ViewSwitcher";
import { usePortfolioChart, usePortfolioSummary } from "@/hooks/usePortfolio";
import { useCoinStats } from "@/hooks/useStats";
import StatTile from "@/components/ui/StatTile";
import Delta from "@/components/ui/Delta";
import Tile from "@/components/ui/Tile";
import WalletsTable from "@/components/tables/WalletsTable";
import FlowTable from "@/components/tables/FlowTable";
import {
  convertUsd,
  eth,
  fmtUSD,
  sats,
  sumBigintWalletField,
  toNum,
  toNumNull,
} from "@/lib/utils/num";

const PortfolioPage = () => {
  const [currentView, setCurrentView] = useState<CoinType>(
    "bitcoin" as CoinType,
  );

  const options = [
    {
      id: "bitcoin",
      text: "Bitcoin",
      link: "?chain=btc",
    },
    {
      id: "ethereum",
      text: "Ethereum",
      link: "?chain=eth",
    },
  ];

  const currentType = currentView === "bitcoin" ? "BTC" : "ETH";
  const { data: chartData, isLoading: isLoadingChart } =
    usePortfolioChart(currentView);
  const { data: summaryData, isLoading: isLoadingSummary } =
    usePortfolioSummary(currentView);
  const { data: statsData, isLoading: isLoadingStats } =
    useCoinStats(currentView);

  const totals = summaryData.totals;
  const wallets = summaryData.wallets;
  const points = chartData.points;
  const range = chartData.range;
  const priceUsd = toNumNull(statsData.priceUsd) ?? 0;
  const changeFraction =
    typeof statsData.change24h === "number"
      ? statsData.change24h
      : typeof statsData.change24hPct === "number"
        ? toNum(statsData.change24hPct) / 100
        : null;
  const combinedTotals =
    wallets.length > 0
      ? {
          balance: sumBigintWalletField(wallets, "balance").toString(),
          totalReceived: sumBigintWalletField(
            wallets,
            "totalReceived",
          ).toString(),
          totalSent: sumBigintWalletField(wallets, "totalSent").toString(),
          pendingDelta: sumBigintWalletField(
            wallets,
            "pendingDelta",
          ).toString(),
        }
      : totals;
  const portfolioUsd =
    priceUsd > 0
      ? convertUsd(combinedTotals.balance, currentView) * priceUsd
      : 0;
  const totalTxs = wallets.reduce(
    (sum: number, w: WalletStat) =>
      sum + (typeof w.txCount === "number" ? w.txCount : 0),
    0,
  );

  return (
    <main className="mx-auto max-w-4xl p-1 pt-6 space-y-8">
      <section className="space-y-1">
        <PageTitle title={`${currentView} Portfolio`} />

        {priceUsd > 0 && (
          <p className="text-sm text-gray-500">
            {currentType}:{" "}
            {new Intl.NumberFormat(undefined, {
              style: "currency",
              currency: "USD",
              maximumFractionDigits: 0,
            }).format(priceUsd)}
          </p>
        )}
      </section>

      <ViewSwitcher
        options={options}
        current={currentView}
        setCurrent={(view) => setCurrentView(view as CoinType)}
      />

      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:contents">
          <Tile
            label="Portfolio Value"
            value={priceUsd > 0 ? fmtUSD(portfolioUsd) : "-"}
          />
          <Tile label="Daily Change" value={changeFraction} isDelta={true} />
          // Comparent Tile
          <Tile label="Total Transactions" value={totalTxs.toLocaleString()} />
        </div>

        <Tile label="Balance" value={sats(totals.balance)} />
        <Tile label="Total Received" value={sats(totals.totalReceived)} />
        <Tile label="Total Sent" value={sats(totals.totalSent)} />
        <Tile label="Pending Δ" value={sats(totals.pendingDelta)} />
      </section>

      <PortfolioChart className="mt-2" />

      <WalletsTable
        wallets={wallets}
        unitFmt={currentView === "bitcoin" ? sats : (n) => eth(n)}
        unitLabel={currentType}
      />

      <FlowTable
        points={points}
        unitFmt={currentView === "bitcoin" ? sats : (n) => eth(n)}
        unitLabel={currentType}
      />
    </main>
  );
};

export default PortfolioPage;
