// src/app/(dashboard)/dashboard/silver/page.tsx
import React from "react";
import CommodityTopTiles from "@/components/toptiles/CommodityTopTiles";
import MetalChart from "@/components/charts/MetalsChart";
import Polymarket from "@/components/Polymarket";import {
  CurrencyProvider,
  CurrencyToggle,
} from "@/components/Currency";

export default function SilverPage() {
  return (
    <CurrencyProvider>
    <div className="space-y-6 mx-auto max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span>Silver</span>
        </h1>
        <div className="self-start sm:self-auto">
            <CurrencyToggle currencies={["USD"]} />
        </div>
      </div>
        <CommodityTopTiles asset="silver" />
        <div className="grid grid-cols-1 gap-6">
            <MetalChart metal="silver" />
        </div>
        {/* New: Polymarket section */}
        <div className="lg:col-span-2">
          <Polymarket limit={8} livePrices asset="silver"/>
        </div>
    </div>
    </CurrencyProvider>
  );
}


