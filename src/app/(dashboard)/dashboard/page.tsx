import CryptoComparisonChart from "@/components/charts/CompareChart";
import MarketProvider from "@/components/providers/MarketProvider";
import MarketList from "@/components/market/MarketList";
import PortfolioWorkspaceOverview from "@/components/portfolio/PortfolioWorkspaceOverview";

export default function DashboardPage() {
  return <MarketProvider>
    <div className="space-y-4" aria-label="Authenticated market analysis">
      <div className="enterprise-workspace-header"><div>
        <span className="enterprise-section-eyebrow">YOUR WORKSPACE / ANALYSIS</span>
        <h1>Market intelligence<span className="enterprise-accent">.</span></h1>
        <p>Private data from the Value Visuals API, live market charts and comparative research.</p>
      </div></div>
      <PortfolioWorkspaceOverview/>
      <section aria-label="Your tracked markets"><MarketList/></section>
      <section className="enterprise-workspace-section" aria-labelledby="compare-title"><h2 id="compare-title">Compare assets</h2><p>Compare Bitcoin, Ethereum and Monero across market ranges.</p><CryptoComparisonChart initialBase="bitcoin" initialQuote="ethereum"/></section>
    </div>
  </MarketProvider>;
}
