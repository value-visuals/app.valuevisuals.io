// src/app/(dashboard)/dashboard/gold/page.tsx
import React from "react";
import GoldTopTile from "@/components/toptiles/GoldTopTile";
import MetalChart from "@/components/charts/MetalsChart";
import Polymarket from "@/components/Polymarket";

export default function GoldPage() {
  return (
    <div className="space-y-6 mx-auto max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span>Gold</span>
        </h1>
      </div>
        <GoldTopTile />
        <div className="grid grid-cols-1 gap-6">
            <MetalChart metal="gold" />
        </div>
        {/* New: Polymarket section */}
        <div className="lg:col-span-2">
          <Polymarket limit={8} livePrices asset="gold"/>
        </div>
    </div>
  );
}



        