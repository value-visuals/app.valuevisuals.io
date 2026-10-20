import { readBearer } from "@/lib/auth/serverBearer";
// src/app/api/crypto/portfolio/bitcoin/route.ts
import { NextResponse } from "next/server";

import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

// Read only the explicit Firebase Authorization bearer token
async function getAuthHeader(req: Request) {
  return readBearer(req);
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const view = (url.searchParams.get("view") || "summary").toLowerCase();
    const range = (url.searchParams.get("range") || "30d").toLowerCase();

    const backend = getApiUrl();
    const endpoint =
      view === "chart"
        ? `${backend}/api/portfolio/btc/chart?chain=btc&range=${encodeURIComponent(range)}`
        : `${backend}/api/portfolio/btc/summary?chain=btc`;

    // Compose upstream headers
    const authHeader = await getAuthHeader(req);
    if (!authHeader) return NextResponse.json({ error: "Firebase authentication required" }, { status: 401 });

    const upstreamRes = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
      },
      cache: "no-store",
    });

    // Bubble up upstream error body/status for easier debugging
    if (!upstreamRes.ok) {
      const text = await upstreamRes.text();
      return NextResponse.json(
        { error: `Upstream error (${upstreamRes.status}): ${text}` },
        { status: upstreamRes.status },
      );
    }

    const data = await upstreamRes.json();
    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Unknown error in /api/crypto/portfolio" },
      { status: 500 },
    );
  }
}
