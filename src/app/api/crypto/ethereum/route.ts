// src/app/api/crypto/ethereum/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 60;
export const runtime = "nodejs";

async function getAuthHeader(req: Request) {
  const hdr = req.headers.get("authorization");
  if (hdr?.startsWith("Bearer ")) return hdr;
  const store = await cookies();
  const token = store.get("__session")?.value || store.get("idToken")?.value;
  return token ? `Bearer ${token}` : undefined;
}

export async function GET(req: Request) {
  try {
    const API_BASE = getApiUrl();
    const auth = await getAuthHeader(req);
    if (!auth) {
      return NextResponse.json(
        { error: "Missing Authorization bearer token" },
        { status: 401 }
      );
    }

    const [sumRes, globalRes] = await Promise.all([
      fetch(`${API_BASE}/api/crypto/summary?symbols=ETH`, {
        headers: { Authorization: auth },
        // @ts-ignore
        next: { revalidate },
      }),
      fetch(`${API_BASE}/api/crypto/global`, {
        headers: { Authorization: auth },
        // @ts-ignore
        next: { revalidate },
      }),
    ]);

    let priceUsd: number | null = null;
    let change24hPct: number | null = null;
    let marketCapUsd: number | null = null;
    let volume24hUsd: number | null = null;
    let dominancePct: number | null = null;

    if (sumRes.ok) {
      const summary = await sumRes.json();
      const row = Array.isArray(summary?.data)
        ? summary.data.find((x: any) => x.symbol === "ETH")
        : null;
      if (row) {
        priceUsd = row.priceUsd ?? null;
        change24hPct = row.change24hPct ?? null;
        marketCapUsd = row.marketCapUsd ?? null;
        volume24hUsd = row.volume24hUsd ?? null;
      }
    }

    const change24h = change24hPct == null ? null : change24hPct / 100;

    if (globalRes.ok) {
      const global = await globalRes.json();
      const total = global?.marketCapUsd ?? null;
      if (marketCapUsd != null && total) {
        dominancePct = total > 0 ? marketCapUsd / total : null; // fraction 0..1
      }
    }

    return NextResponse.json(
      { priceUsd, change24h, change24hPct, marketCapUsd, volume24hUsd, dominancePct },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/crypto/ethereum] proxy failed:", err?.message || err);
    return NextResponse.json({ error: "Failed", detail: err?.message }, { status: 500 });
  }
}
