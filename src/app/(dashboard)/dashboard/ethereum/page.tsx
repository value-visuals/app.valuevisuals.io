// src/app/(dashboard)/dashboard/ethereum/page.tsx
import EthereumTopTile from "@/components/toptiles/EthereumTopTile";
import PriceChart from "@/components/charts/PriceChart";
import { CurrencyProvider } from "@/components/Currency";
import Image from "next/image";
import Polymarket from "@/components/Polymarket";

export default function EthereumPage() {
  return (
    <CurrencyProvider>
    <div className="space-y-6 mx-auto max-w-7xl">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Image src={`/ethereum.png`} alt={`Ethereum`} width={20} height={20} />
          <span>Ethereum</span>
        </h1>
      </div>

      <EthereumTopTile />

        <div className="grid grid-cols-1 gap-6">
          <PriceChart coin="ethereum" />
        </div>

        {/* New: Polymarket section */}
        <div className="lg:col-span-2">
          <Polymarket limit={8} livePrices asset="ethereum"/>
        </div>
    </div>
    </CurrencyProvider>
  );
}
