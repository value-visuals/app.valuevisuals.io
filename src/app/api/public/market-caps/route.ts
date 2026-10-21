import { NextResponse } from "next/server";
import { fetchPublicMarketApi } from "@/lib/market/publicBackend";
import type { MarketCapRankingResponse } from "@/lib/market/assetMarketCapTypes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const currency = (params.get("currency") ?? "USD").toUpperCase();
  const limit = params.get("limit") ?? "100";
  if (!["USD", "EUR", "GBP"].includes(currency) || !["10", "100"].includes(limit)) {
    return NextResponse.json({ error: "Unsupported currency or limit" }, { status: 400 });
  }
  try {
    const data = await fetchPublicMarketApi<MarketCapRankingResponse>(
      `/api/market/caps?currency=${currency}&limit=${limit}`,
    );
    if (
      !data ||
      data.source !== "AssetMarketCap" ||
      data.currency !== currency ||
      !Array.isArray(data.data) ||
      data.data.length === 0 ||
      data.data.length > Number(limit) ||
      !Number.isInteger(data.count) ||
      data.count < data.data.length ||
      typeof data.fetchedAt !== "string" ||
      !data.data.every((asset) =>
        asset && Number.isInteger(asset.rank) &&
        typeof asset.name === "string" &&
        typeof asset.ticker === "string" &&
        typeof asset.assetType === "string" &&
        (asset.trackedAsset === null ||
          ["bitcoin", "ethereum", "monero", "gold", "silver"].includes(asset.trackedAsset)) &&
        (asset.marketCap === null || (typeof asset.marketCap === "number" && Number.isFinite(asset.marketCap))) &&
        (asset.marketCapUsd === null || (typeof asset.marketCapUsd === "number" && Number.isFinite(asset.marketCapUsd)))
      )
    ) {
      throw new Error("Invalid ranking response from backend");
    }
    return NextResponse.json(data, {
      headers: {
        // Shared cache for responses to clients; the backend manages the Firestore snapshot cache.
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    });
  } catch (error) {
    console.error("[public/market-caps] Backend ranking unavailable:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Market capitalization feed temporarily unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
