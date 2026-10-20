import CryptoTopTiles from "@/components/toptiles/CryptoTopTiles";
import PriceChart from "@/components/charts/PriceChart";
import Polymarket from "@/components/Polymarket";
import AssetMark from "@/components/market/AssetMark";

export default function EthereumPage() {
  return <div className="space-y-6">
    <header className="enterprise-workspace-header">
      <div><span className="enterprise-section-eyebrow">MARKETS / CRYPTO / ETHEREUM</span>
        <h1 className="flex items-center gap-3"><AssetMark asset="ethereum" size={36}/>Ethereum</h1>
        <p>Historical performance, market statistics and event intelligence.</p>
      </div>
    </header>
    <CryptoTopTiles asset="ethereum"/>
    <section aria-label="Ethereum price chart"><PriceChart coin="ethereum"/></section>
    <section aria-label="Ethereum prediction markets"><Polymarket limit={8} livePrices asset="ethereum"/></section>
  </div>;
}
