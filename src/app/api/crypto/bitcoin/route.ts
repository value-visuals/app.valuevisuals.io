import { readBearer } from "@/lib/auth/serverBearer";
// src/app/api/crypto/bitcoin/route.ts
import { NextResponse } from "next/server";

import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const runtime = "nodejs";

async function getAuthHeader(req: Request) {
  return readBearer(req);
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
      fetch(`${API_BASE}/api/crypto/summary?symbols=BTC`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
      fetch(`${API_BASE}/api/crypto/global`, {
        headers: { Authorization: auth },
        cache: "no-store",
      }),
    ]);

    if (sumRes.status === 401 || globalRes.status === 401) {
      return NextResponse.json({ error: "Firebase session rejected" }, { status: 401 });
    }

    let priceUsd: number | null = null;
    let change24hPct: number | null = null;
    let marketCapUsd: number | null = null;
    let volume24hUsd: number | null = null;
    let dominancePct: number | null = null;

    if (sumRes.ok) {
      const summary = await sumRes.json();
      const row = Array.isArray(summary?.data)
        ? summary.data.find((x: any) => x.symbol === "BTC")
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
      // Prefer computed dominance; fallback to provider's dominance (Paprika returns percent)
      if (marketCapUsd != null && total) {
        dominancePct = total > 0 ? marketCapUsd / total : null; // fraction 0..1
      } else if (global?.btcDominancePct != null) {
        dominancePct = Number(global.btcDominancePct) / 100; // convert percent -> fraction
      }
    }

    return NextResponse.json(
      { priceUsd, change24h, change24hPct, marketCapUsd, volume24hUsd, dominancePct },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("[/api/crypto/bitcoin] proxy failed:", err?.message || err);
    return NextResponse.json({ error: "Failed", detail: err?.message }, { status: 500 });
  }
}
