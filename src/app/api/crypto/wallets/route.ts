// src/app/api/crypto/portfolio/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 60;
export const runtime = "nodejs";

// Same auth pattern as your bitcoin route
async function getAuthHeader(req: Request) {
  const hdr = req.headers.get("authorization");
  if (hdr?.startsWith("Bearer ")) return hdr;
  const store = await cookies();
  const token = store.get("__session")?.value || store.get("idToken")?.value;
  return token ? `Bearer ${token}` : undefined;
}

// ---------- GET /api/crypto/portfolio?chain=btc|eth ----------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chain = searchParams.get("chain");
  const upstreamUrl = `${getApiUrl()}/api/user/wallets${chain ? `?chain=${encodeURIComponent(chain)}` : ""}`;

  const auth = await getAuthHeader(req);
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;

  const upstream = await fetch(upstreamUrl, { method: "GET", headers, cache: "no-store" });
  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

// ---------- POST /api/crypto/portfolio  { chain, address } ----------
export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  let parsed: any = null;
  try { parsed = JSON.parse(bodyText || "{}"); } catch {}
  if (!parsed || !parsed.chain || !parsed.address) {
    return NextResponse.json({ error: "Body must include chain and address" }, { status: 400 });
  }

  const auth = await getAuthHeader(req);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["authorization"] = auth;

  const upstream = await fetch(`${getApiUrl()}/api/user/wallets`, {
    method: "POST",
    headers,
    body: bodyText,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

// ---------- PUT /api/crypto/portfolio  { chain, oldAddress, newAddress } ----------
export async function PUT(req: NextRequest) {
  const bodyText = await req.text();
  let parsed: any = null;
  try { parsed = JSON.parse(bodyText || "{}"); } catch {}
  if (!parsed || !parsed.chain || !parsed.oldAddress || !parsed.newAddress) {
    return NextResponse.json(
      { error: "Body must include chain, oldAddress, newAddress" },
      { status: 400 }
    );
  }

  const auth = await getAuthHeader(req);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["authorization"] = auth;

  const upstream = await fetch(`${getApiUrl()}/api/user/wallets`, {
    method: "PUT",
    headers,
    body: bodyText,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

// ---------- DELETE /api/crypto/portfolio?chain=...&address=... ----------
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const chainQs = searchParams.get("chain");
  const addressQs = searchParams.get("address");

  // Accept JSON body as fallback if query params aren’t provided
  let bodyText = "";
  if (!chainQs || !addressQs) {
    bodyText = await req.text();
    try {
      const parsed = JSON.parse(bodyText || "{}");
      if (!parsed?.chain || !parsed?.address) {
        return NextResponse.json(
          { error: "Provide chain and address (query or JSON body)" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const auth = await getAuthHeader(req);
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  if (bodyText) headers["Content-Type"] = "application/json";

  const upstreamUrl = `${getApiUrl()}/api/user/wallets${
    chainQs && addressQs
      ? `?chain=${encodeURIComponent(chainQs)}&address=${encodeURIComponent(addressQs)}`
      : ""
  }`;

  const upstream = await fetch(upstreamUrl, {
    method: "DELETE",
    headers,
    body: bodyText || undefined,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}
