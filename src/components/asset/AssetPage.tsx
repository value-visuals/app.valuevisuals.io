import type { CSSProperties } from "react";
import AssetMark from "@/components/market/AssetMark";
import PriceChart from "@/components/charts/PriceChart";
import MetalsChart from "@/components/charts/MetalsChart";
import CryptoTopTiles from "@/components/toptiles/CryptoTopTiles";
import CommodityTopTiles from "@/components/toptiles/CommodityTopTiles";
import AssetPredictionMarkets from "./AssetPredictionMarkets";
import AssetDetails, { DisplayCurrency } from "./AssetDetails";
import BitcoinDetails from "./BitcoinDetails";
import styles from "./AssetPage.module.css";

type CryptoAsset = "bitcoin" | "ethereum" | "monero";
type MetalAsset = "gold" | "silver";
export type AssetId = CryptoAsset | MetalAsset;

type AssetMeta = {
  name: string;
  symbol: string;
  category: string;
  accent: string;
};

const ASSETS: Record<AssetId, AssetMeta> = {
  bitcoin: { name: "Bitcoin", symbol: "BTC", category: "Crypto", accent: "#f7931a" },
  ethereum: { name: "Ethereum", symbol: "ETH", category: "Crypto", accent: "#627eea" },
  monero: { name: "Monero", symbol: "XMR", category: "Crypto", accent: "#ff6600" },
  gold: { name: "Gold", symbol: "XAU", category: "Precious metals", accent: "#c99d35" },
  silver: { name: "Silver", symbol: "XAG", category: "Precious metals", accent: "#93a3b3" },
};

export default function AssetPage({ asset }: { asset: AssetId }) {
  const meta = ASSETS[asset];
  const isCrypto = asset === "bitcoin" || asset === "ethereum" || asset === "monero";

  return (
    <main className={`${styles.page} ${asset === "bitcoin" ? styles.bitcoinPage : ""}`} style={{ "--asset-accent": meta.accent } as CSSProperties}>
      <header className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.eyebrow}>MARKETS / {meta.category.toUpperCase()} / {meta.symbol}</div>
          <div className={styles.nameRow}>
            <AssetMark asset={asset} size={42} />
            <h1>{meta.name}</h1>
            <span className={styles.symbol}>{meta.symbol}</span>
          </div>
          <p>Live market data, historical performance and prediction-market intelligence.</p>
        </div>
        <DisplayCurrency />
      </header>

      {asset === "bitcoin" && (
        <section className={styles.bitcoinTopTiles} aria-label="Bitcoin live market statistics">
          <CryptoTopTiles asset="bitcoin" />
        </section>
      )}

      <div className={`${styles.workspace} ${asset === "bitcoin" ? styles.bitcoinWorkspace : ""}`}>
        <section className={styles.chartSection} aria-label={`${meta.name} price chart`}>
          <div className={styles.sectionTitle}>
            <div><span className={styles.kicker}>PRICE PERFORMANCE</span><h2>{meta.name} chart</h2></div>
            <span className={styles.muted}>Historical market prices</span>
          </div>
          <div className={styles.chartHost}>
            {isCrypto ? <PriceChart coin={asset} /> : <MetalsChart metal={asset} />}
          </div>
        </section>

        <aside className={`${styles.sidebar} ${asset === "bitcoin" ? styles.bitcoinSidebar : ""}`} aria-label={`${meta.name} market statistics`}>
          {asset === "bitcoin" ? <BitcoinDetails /> : <>
          <div className={styles.sidebarHeading}>
            <span className={styles.kicker}>MARKET OVERVIEW</span>
            <h2>Key statistics</h2>
          </div>
          <div className={styles.statStack}>
            {isCrypto ? <CryptoTopTiles asset={asset} className={styles.tiles} /> : <CommodityTopTiles asset={asset} className={styles.tiles} />}
          </div>
          {isCrypto && <AssetDetails asset={asset} />}
          {!isCrypto && <p className={styles.metalNote}>Metal prices are quoted per troy ounce. Market capitalization and circulating supply are not applicable to spot metals.</p>}
          </>}
        </aside>
      </div>

      <section className={styles.predictions} aria-label={`${meta.name} prediction-market intelligence`}>
        <div className={styles.predictionHeading}>
          <div>
            <span className={styles.kicker}>PREDICTION INTELLIGENCE</span>
            <h2>Market expectations</h2>
            <p>Independent probabilities from active Polymarket contracts.</p>
          </div>
          <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className={styles.externalLink}>Polymarket <span aria-hidden="true">↗</span></a>
        </div>
        <AssetPredictionMarkets limit={8} asset={asset} />
        <p className={styles.disclaimer}>Prediction-market probabilities are contract prices, not forecasts of a guaranteed outcome. Polymarket volume and liquidity are denominated in USD regardless of the selected Value Visuals display currency.</p>
      </section>
    </main>
  );
}
