import CommodityTopTiles from "@/components/toptiles/CommodityTopTiles";
import MetalChart from "@/components/charts/MetalsChart";
import Polymarket from "@/components/Polymarket";
import AssetMark from "@/components/market/AssetMark";

export default function SilverPage() {
  return <div className="space-y-6">
    <header className="enterprise-workspace-header">
      <div><span className="enterprise-section-eyebrow">MARKETS / PRECIOUS METALS / SILVER</span>
        <h1 className="flex items-center gap-3"><AssetMark asset="silver" size={36}/>Silver</h1>
        <p>Historical performance, market statistics and event intelligence.</p>
      </div>
    </header>
    <CommodityTopTiles asset="silver"/>
    <section aria-label="Silver price chart"><MetalChart metal="silver"/></section>
    <section aria-label="Silver prediction markets"><Polymarket limit={8} livePrices asset="silver"/></section>
  </div>;
}
