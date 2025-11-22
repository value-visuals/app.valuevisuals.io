// src/app/(dashboard)/dashboard/silver/page.tsx
import React from "react";
import TopTile from "@/components/toptiles/SilverTopTile";
import MetalChart from "@/components/charts/MetalsChart";
import Polymarket from "@/components/Polymarket";

export default function SilverPage() {
  return (
    <div className="space-y-6 mx-auto max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <span>Silver</span>
        </h1>
      </div>
        <TopTile />
        <div className="grid grid-cols-1 gap-6">
            <MetalChart metal="silver" />
        </div>
        {/* New: Polymarket section */}
        <div className="lg:col-span-2">
          <Polymarket limit={8} livePrices asset="silver"/>
        </div>
    </div>
  );
}


