import { NextResponse } from "next/server";

const SUPPORTED_ASSETS = ["bitcoin", "ethereum", "monero"] as const;
const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP"] as const;

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

type CoinGeckoMarket = {
  id?: string;
  market_cap_rank?: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  circulating_supply?: number | null;
  max_supply?: number | null;
  ath?: number | null;
  ath_date?: string | null;
  atl?: number | null;
  atl_date?: string | null;
  last_updated?: string | null;
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const asset = params.get("asset")?.toLowerCase() ?? "";
  const currency = params.get("currency")?.toUpperCase() ?? "";
  if (!SUPPORTED_ASSETS.some((value) => value === asset) || !SUPPORTED_CURRENCIES.some((value) => value === currency)) {
    return NextResponse.json({ error: "Unsupported asset or currency" }, { status: 400 });
  }

  const upstream = new URL("https://api.coingecko.com/api/v3/coins/markets");
  upstream.searchParams.set("vs_currency", currency.toLowerCase());
  upstream.searchParams.set("ids", asset);
  upstream.searchParams.set("order", "market_cap_desc");
  upstream.searchParams.set("per_page", "1");
  upstream.searchParams.set("page", "1");
  upstream.searchParams.set("sparkline", "false");

  const headers: Record<string, string> = { accept: "application/json" };
  const key = process.env.COINGECKO_DEMO_API_KEY;
  if (key) headers["x-cg-demo-api-key"] = key;

  try {
    const response = await fetch(upstream, { headers, next: { revalidate: 300 }, signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`CoinGecko returned ${response.status}`);
    const raw: unknown = await response.json();
    if (!Array.isArray(raw)) throw new Error("Unexpected upstream response");
    const market = raw.find((value): value is CoinGeckoMarket => value && typeof value === "object" && value.id === asset);
    if (!market) throw new Error("Asset not found in upstream response");
    return NextResponse.json({
      source: "coingecko",
      currency,
      updatedAt: typeof market.last_updated === "string" ? market.last_updated : null,
      rank: finiteOrNull(market.market_cap_rank),
      high24h: finiteOrNull(market.high_24h),
      low24h: finiteOrNull(market.low_24h),
      circulatingSupply: finiteOrNull(market.circulating_supply),
      maxSupply: finiteOrNull(market.max_supply),
      allTimeHigh: finiteOrNull(market.ath),
      allTimeHighDate: typeof market.ath_date === "string" ? market.ath_date : null,
      allTimeLow: finiteOrNull(market.atl),
      allTimeLowDate: typeof market.atl_date === "string" ? market.atl_date : null,
    });
  } catch {
    // Do not let a rate-limited free provider affect the working core backend.
    return NextResponse.json({ error: "Supplemental data unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
