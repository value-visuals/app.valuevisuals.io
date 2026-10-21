import type { CSSProperties } from "react";
import AssetMark from "@/components/market/AssetMark";
import PriceChart from "@/components/charts/PriceChart";
import MetalsChart from "@/components/charts/MetalsChart";
import CryptoTopTiles from "@/components/toptiles/CryptoTopTiles";
import CommodityTopTiles from "@/components/toptiles/CommodityTopTiles";
import AssetPredictionMarkets from "./AssetPredictionMarkets";
import AssetDetails, { DisplayCurrency } from "./AssetDetails";
import BitcoinDetails from "./BitcoinDetails";
import MetalDetails from "./MetalDetails";
import styles from "./AssetPage.module.css";

type CryptoAsset = "bitcoin" | "ethereum" | "monero";
type MetalAsset = "gold" | "silver";
export type AssetId = CryptoAsset | MetalAsset;

type AssetMeta = {
  name: string;
  symbol: string;
  category: string;
  accent: string;
  description: string;
};

const ASSETS: Record<AssetId, AssetMeta> = {
  bitcoin: {
    name: "Bitcoin", symbol: "BTC", category: "Crypto", accent: "#f7931a",
    description: "Price history, Bitcoin network statistics and prediction-market activity.",
  },
  ethereum: {
    name: "Ethereum", symbol: "ETH", category: "Crypto", accent: "#627eea",
    description: "Live price history, supply metrics and Ethereum prediction markets.",
  },
  monero: {
    name: "Monero", symbol: "XMR", category: "Crypto", accent: "#ff6600",
    description: "Monero price performance, market fundamentals and prediction markets.",
  },
  gold: {
    name: "Gold", symbol: "XAU", category: "Metals", accent: "#c99d35",
    description: "Spot price per troy ounce, weight conversions and prediction markets.",
  },
  silver: {
    name: "Silver", symbol: "XAG", category: "Metals", accent: "#93a3b3",
    description: "Spot price per troy ounce, weight conversions and prediction markets.",
  },
};

export default function AssetPage({ asset }: { asset: AssetId }) {
  const meta = ASSETS[asset];
  const isCrypto = asset === "bitcoin" || asset === "ethereum" || asset === "monero";

  return (
    <main
      className={styles.page}
      style={{ "--asset-accent": meta.accent } as CSSProperties}
    >
      <header className={styles.header}>
        <div className={styles.identity}>
          <div className={styles.eyebrow}>MARKETS / {meta.category.toUpperCase()} / {meta.symbol}</div>
          <div className={styles.nameRow}>
            <AssetMark asset={asset} size={42} />
            <h1>{meta.name}</h1>
            <span className={styles.symbol}>{meta.symbol}</span>
          </div>
          <p>{meta.description}</p>
        </div>
        <div className={styles.headerActions}>
          <DisplayCurrency />
          <nav aria-label={`${meta.name} sections`} className={styles.sectionNav}>
            <a href="#asset-price">Price chart</a>
            <a href="#asset-metrics">Market data</a>
            <a href="#asset-predictions">Predictions</a>
          </nav>
        </div>
      </header>

      <section className={styles.topTiles} aria-label={`${meta.name} market snapshot`}>
        {isCrypto ? <CryptoTopTiles asset={asset} /> : <CommodityTopTiles asset={asset} />}
      </section>

      <div className={styles.workspace}>
        <section id="asset-price" className={styles.chartSection} aria-label={`${meta.name} price chart`}>
          <div className={styles.chartHost}>
            {isCrypto ? <PriceChart coin={asset} /> : <MetalsChart metal={asset} />}
          </div>
        </section>

        <aside id="asset-metrics" className={styles.sidebar} aria-label={`${meta.name} market details`}>
          {asset === "bitcoin" ? <BitcoinDetails /> :
            asset === "ethereum" || asset === "monero" ? <AssetDetails asset={asset} /> : <MetalDetails asset={asset} />}
        </aside>
      </div>

      <section id="asset-predictions" className={styles.predictions} aria-label={`${meta.name} prediction-market intelligence`}>
        <div className={styles.predictionHeading}>
          <div>
            <span className={styles.kicker}>PREDICTION INTELLIGENCE / {meta.symbol}</span>
            <h2>Prediction markets</h2>
            <p>Live contract probabilities, volume and liquidity for {meta.name}.</p>
          </div>
          <a href="https://polymarket.com" target="_blank" rel="noopener noreferrer" className={styles.externalLink}>
            Explore Polymarket <span aria-hidden="true">↗</span>
          </a>
        </div>
        <AssetPredictionMarkets asset={asset} limit={8} />
        <p className={styles.disclaimer}>
          Contract prices indicate market-implied probabilities, not guaranteed outcomes or financial advice.
          Polymarket volume and liquidity are shown in USD regardless of the selected display currency.
        </p>
      </section>
    </main>
  );
}
