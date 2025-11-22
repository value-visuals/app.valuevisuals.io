// src/app/api/polymarket/gold/route.ts
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

  const url = `${getApiUrl()}/api/polymarket/gold${qs.toString() ? `?${qs.toString()}` : ""}`;

  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: { accept: "application/json", Authorization: auth },
      cache: "no-store",
      // @ts-ignore
      next: { revalidate },
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return NextResponse.json({ error: `Upstream error: ${resp.status} ${text}` }, { status: 502 });
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
