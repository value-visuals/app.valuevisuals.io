// src/app/api/crypto/ethereum/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 60;
export const runtime = "nodejs";

// Pull Bearer token from Authorization header OR __session/idToken cookies
async function getAuthHeader(req: Request) {
  const hdr = req.headers.get("authorization");
  if (hdr?.startsWith("Bearer ")) return hdr;

  const store = await cookies();
  const token = store.get("__session")?.value || store.get("idToken")?.value;
  return token ? `Bearer ${token}` : undefined;
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

    // Auth + cookies forward
    const headersOut: Record<string, string> = { accept: "application/json" };
    const auth = await getAuthHeader(req);
    if (auth) headersOut.authorization = auth;

    // Forward cookies (in case backend supports cookie auth, too)
    const store = await cookies();
    const cookieJar = store.getAll().map(c => `${c.name}=${c.value}`).join("; ");
    if (cookieJar) headersOut.cookie = cookieJar;

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
