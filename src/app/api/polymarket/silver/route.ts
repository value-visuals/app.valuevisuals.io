import { readBearer } from "@/lib/auth/serverBearer";
// src/app/api/polymarket/silver/route.ts
import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;
export const runtime = "nodejs";

async function getAuthHeader(req: Request) {
  return readBearer(req);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const API_BASE = getApiUrl();
  const auth = await getAuthHeader(request);
      if (!auth) {
        return NextResponse.json(
          { error: "Missing Authorization bearer token" },
          { status: 401 }
        );
      }

  // Allow pass-through of limit/includeClosed/livePrices
  const qs = new URLSearchParams();
  if (searchParams.has("limit")) qs.set("limit", searchParams.get("limit") as string);
  if (searchParams.has("includeClosed")) qs.set("includeClosed", searchParams.get("includeClosed") as string);
  if (searchParams.has("livePrices")) qs.set("livePrices", searchParams.get("livePrices") as string);

  const url = `${getApiUrl()}/api/polymarket/silver${qs.toString() ? `?${qs.toString()}` : ""}`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", Authorization: auth },
      cache: "no-store",
    });

    if (!resp.ok) {
      return NextResponse.json({ error: "Market prediction feed unavailable" }, { status: resp.status === 401 ? 401 : 502 });
    }

    const data = await resp.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err: any) {
    return NextResponse.json({ error: "Failed to reach backend" }, { status: 502 });
  }
}
