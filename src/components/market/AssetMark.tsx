import Image from "next/image";
import type { MarketAssetId } from "@/lib/market/publicMarketTypes";
const icons: Partial<Record<MarketAssetId, string>> = {
  bitcoin: "/bitcoin.svg", ethereum: "/ethereum.png", monero: "/monero.svg",
};
export default function AssetMark({ asset, size = 38 }: { asset: MarketAssetId; size?: number }) {
  const src = icons[asset];
  return <span className={`market-asset-icon ${asset}`} style={{ width: size, height: size }} aria-hidden="true">
    {src ? <Image src={src} alt="" width={Math.round(size * .66)} height={Math.round(size * .66)} /> : <span>{asset === "gold" ? "Au" : "Ag"}</span>}
  </span>;
}
