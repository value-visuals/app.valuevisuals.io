import { readBearer } from "@/lib/auth/serverBearer";
// src/app/api/crypto/ethereum/route.ts
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
    const base = getApiUrl();
    const url = new URL(req.url);
    const view = (url.searchParams.get("view") || "summary").toLowerCase(); // "summary" | "chart"
    const range = url.searchParams.get("range") || "30d";
    const address = url.searchParams.get("address"); // optional passthrough for testing/deeplinks

    // Build upstream URL (NO ?chain=... here)
    const path = view === "chart" ? "/api/portfolio/eth/chart" : "/api/portfolio/eth/summary";
    const qs = new URLSearchParams();
    if (view === "chart") qs.set("range", range);
    if (address) qs.set("address", address);

    const upstream = `${base}${path}${qs.size ? `?${qs.toString()}` : ""}`;

    // Forward only the Authorization bearer token
    const headersOut: Record<string, string> = { accept: "application/json" };
    const auth = await getAuthHeader(req);
  if (!auth) return NextResponse.json({ error: "Firebase authentication required" }, { status: 401 });
    if (auth) headersOut.authorization = auth;

    const res = await fetch(upstream, { headers: headersOut, cache: "no-store" });
    const text = await res.text();

    // Pass through status/body so you see 4xx from backend rather than a 500
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "Upstream error" },
      { status: 500 }
    );
  }
}
