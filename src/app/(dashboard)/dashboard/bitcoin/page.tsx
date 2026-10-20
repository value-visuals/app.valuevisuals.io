import CryptoTopTiles from "@/components/toptiles/CryptoTopTiles";
import PriceChart from "@/components/charts/PriceChart";
import Polymarket from "@/components/Polymarket";
import AssetMark from "@/components/market/AssetMark";

export default function BitcoinPage() {
  return <div className="space-y-6">
    <header className="enterprise-workspace-header">
      <div><span className="enterprise-section-eyebrow">MARKETS / CRYPTO / BITCOIN</span>
        <h1 className="flex items-center gap-3"><AssetMark asset="bitcoin" size={36}/>Bitcoin</h1>
        <p>Historical performance, market statistics and event intelligence.</p>
      </div>
    </header>
    <CryptoTopTiles asset="bitcoin"/>
    <section aria-label="Bitcoin price chart"><PriceChart coin="bitcoin"/></section>
    <section aria-label="Bitcoin prediction markets"><Polymarket limit={8} livePrices asset="bitcoin"/></section>
  </div>;
}
