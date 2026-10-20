import CommodityTopTiles from "@/components/toptiles/CommodityTopTiles";
import MetalChart from "@/components/charts/MetalsChart";
import Polymarket from "@/components/Polymarket";
import AssetMark from "@/components/market/AssetMark";

export default function GoldPage() {
  return <div className="space-y-6">
    <header className="enterprise-workspace-header">
      <div><span className="enterprise-section-eyebrow">MARKETS / PRECIOUS METALS / GOLD</span>
        <h1 className="flex items-center gap-3"><AssetMark asset="gold" size={36}/>Gold</h1>
        <p>Historical performance, market statistics and event intelligence.</p>
      </div>
    </header>
    <CommodityTopTiles asset="gold"/>
    <section aria-label="Gold price chart"><MetalChart metal="gold"/></section>
    <section aria-label="Gold prediction markets"><Polymarket limit={8} livePrices asset="gold"/></section>
  </div>;
}
