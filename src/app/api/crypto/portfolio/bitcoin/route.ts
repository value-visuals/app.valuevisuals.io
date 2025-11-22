// src/app/api/crypto/portfolio/bitcoin/route.ts
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
    const cookieStr = req.headers.get("cookie") || "";

    const upstreamRes = await fetch(endpoint, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(authHeader ? { authorization: authHeader } : {}),
        ...(cookieStr ? { cookie: cookieStr } : {}),
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
