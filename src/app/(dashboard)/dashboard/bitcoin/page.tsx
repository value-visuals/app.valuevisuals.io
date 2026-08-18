// src/app/(dashboard)/dashboard/bitcoin/page.tsx
import CryptoTopTiles from "@/components/toptiles/CryptoTopTiles";
import PriceChart from "@/components/charts/PriceChart";
import {
  CurrencyProvider,
  CurrencyToggle,
} from "@/components/Currency";
import Image from "next/image";
import Polymarket from "@/components/Polymarket";

export default function BitcoinPage() {
  return (
    <CurrencyProvider>
      <div className="space-y-6  mx-auto max-w-7xl">
        <div className="flex items-center justify-between">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Image src={`/bitcoin.svg`} alt={`Bitcoin`} width={20} height={20} />
            <span>Bitcoin</span>
          </h1>
          <div className="self-start sm:self-auto">       
              <CurrencyToggle />
          </div>
        </div>

        <CryptoTopTiles asset="bitcoin" />

          <div className="grid grid-cols-1 gap-6">
            <PriceChart coin="bitcoin" />
          </div>

          {/* New: Polymarket section */}
          <div className="lg:col-span-2">
            <Polymarket limit={8} livePrices asset="bitcoin"/>
          </div>
      </div>
    </CurrencyProvider>
  );
}
