// src/app/api/crypto/summary/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 60;
export const runtime = "nodejs"; // ensure Node runtime for server fetch

async function getAuthHeader(req: Request) {
  const hdr = req.headers.get("authorization");
  if (hdr?.startsWith("Bearer ")) return hdr;

  const store = await cookies(); // async in newer Next
  const token =
    store.get("__session")?.value ||
    store.get("idToken")?.value ||
    undefined;

  return token ? `Bearer ${token}` : undefined;
}

// src/app/api/crypto/summary/route.ts
export async function GET(req: Request) {
  try {
    const API_BASE = getApiUrl();
    const auth = await getAuthHeader(req);

    const { searchParams } = new URL(req.url);
    const symbols = searchParams.get("symbols") ?? "BTC,ETH";
    const currency = (searchParams.get("currency") ?? "USD").toUpperCase(); // <- NEW
    const curKey = currency.toLowerCase(); // "usd" | "eur" | "gbp"

    // forward currency to backend
    const [summaryRes, globalRes] = await Promise.all([
      fetch(
        `${API_BASE}/api/crypto/summary?symbols=${encodeURIComponent(symbols)}&currency=${encodeURIComponent(currency)}`,
        { headers: { Authorization: auth! }, next: { revalidate } as any }
      ),
      fetch(
        `${API_BASE}/api/crypto/global?currency=${encodeURIComponent(currency)}`,
        { headers: { Authorization: auth! }, next: { revalidate } as any }
      ),
    ]);

    const summary = await summaryRes.json(); 
    const global = await globalRes.json();  

    // build dynamic currency keys for backward-compat shape
    const slugMap: Record<string, string> = { BTC: "bitcoin", ETH: "ethereum" };
    const out: Record<string, any> = {};

    for (const row of summary.data || []) {
      const sym = String(row.symbol || "").toUpperCase();
      const slug = slugMap[sym] ?? sym.toLowerCase();
      const val =
        typeof row.price === "number" ? row.price :
        typeof row.priceUsd === "number" ? row.priceUsd : null;
      out[slug] = { [curKey]: val }; 
    }

    // global cap with dynamic currency key
    const capVal =
      typeof global.marketCap === "number" ? global.marketCap :
      typeof global.marketCapUsd === "number" ? global.marketCapUsd : null;

    out.global_market_cap = { [curKey]: capVal };

    return NextResponse.json(out, { status: 200 });
  } catch (err: any) {
    console.error("[/api/crypto/summary] proxy failed:", err?.message || err);
    return NextResponse.json({ error: "Failed", detail: err?.message }, { status: 500 });  
  }
}
