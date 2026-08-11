// src/app/(dashboard)/dashboard/monero/page.tsx
import MoneroTopTile from "@/components/toptiles/MoneroTopTile";
import PriceChart from "@/components/charts/PriceChart";
import { CurrencyProvider } from "@/components/Currency";
import Image from "next/image";
import Polymarket from "@/components/Polymarket";

export default function MoneroPage() {
  return (
    <CurrencyProvider>
      <div className="space-y-6  mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Image src={`/monero.png`} alt={`Monero`} width={20} height={20} />
            <span>Monero</span>
          </h1>
        </div>

        <MoneroTopTile />

          <div className="grid grid-cols-1 gap-6">
            <PriceChart coin="monero" />
          </div>

          {/* New: Polymarket section */}
          <div className="lg:col-span-2">
            <Polymarket limit={8} livePrices asset="monero"/>
          </div>
      </div>
    </CurrencyProvider>
  );
}
