import CryptoTopTiles from "@/components/toptiles/CryptoTopTiles";
import PriceChart from "@/components/charts/PriceChart";
import Polymarket from "@/components/Polymarket";
import AssetMark from "@/components/market/AssetMark";

export default function MoneroPage() {
  return <div className="space-y-6">
    <header className="enterprise-workspace-header">
      <div><span className="enterprise-section-eyebrow">MARKETS / CRYPTO / MONERO</span>
        <h1 className="flex items-center gap-3"><AssetMark asset="monero" size={36}/>Monero</h1>
        <p>Historical performance, market statistics and event intelligence.</p>
      </div>
    </header>
    <CryptoTopTiles asset="monero"/>
    <section aria-label="Monero price chart"><PriceChart coin="monero"/></section>
    <section aria-label="Monero prediction markets"><Polymarket limit={8} livePrices asset="monero"/></section>
  </div>;
}
