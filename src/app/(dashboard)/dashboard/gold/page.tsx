// src/app/(dashboard)/dashboard/gold/page.tsx
import React from "react";
import GoldTopTile from "@/components/toptiles/GoldTopTile";
import MetalChart from "@/components/charts/MetalsChart";
import Polymarket from "@/components/Polymarket";
import {
  CurrencyProvider,
  CurrencyToggle,
} from "@/components/Currency";

export default function GoldPage() {
  return (
    <CurrencyProvider>
      <div className="space-y-6 mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <span>Gold</span>
          </h1>

          <div className="self-start sm:self-auto">
            <CurrencyToggle currencies={["USD"]} />
          </div>
        </div>

        <GoldTopTile />

        <div className="grid grid-cols-1 gap-6">
          <MetalChart metal="gold" />
        </div>

        <div className="lg:col-span-2">
          <Polymarket limit={8} livePrices asset="gold" />
        </div>
      </div>
    </CurrencyProvider>
  );
}



        