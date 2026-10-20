import { readBearer } from "@/lib/auth/serverBearer";
// app/api/metals/wallets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

// Same auth pattern as your existing crypto route
async function getAuthHeader(req: Request) {
  return readBearer(req);
}

// ---------- GET /api/metals/wallets?metal=gold|silver ----------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const metal = searchParams.get("metal");

  const upstreamUrl = `${getApiUrl()}/api/user/metalswallet${metal ? `?metal=${encodeURIComponent(metal)}` : ""}`;

  const auth = await getAuthHeader(req);
  if (!auth) return NextResponse.json({ error: "Firebase authentication required" }, { status: 401 });
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;

  const upstream = await fetch(upstreamUrl, { method: "GET", headers, cache: "no-store" });
  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

// ---------- POST /api/metals/wallets  { metal, name, amount, unit } ----------
export async function POST(req: NextRequest) {
  const bodyText = await req.text();
  let parsed: any = null;
  try { parsed = JSON.parse(bodyText || "{}"); } catch {}
  if (!parsed || !parsed.metal || !parsed.name || !parsed.amount || !parsed.unit) {
    return NextResponse.json(
      { error: "Body must include metal, name, amount, unit" },
      { status: 400 }
    );
  }

  const auth = await getAuthHeader(req);
  if (!auth) return NextResponse.json({ error: "Firebase authentication required" }, { status: 401 });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["authorization"] = auth;

  const upstream = await fetch(`${getApiUrl()}/api/user/metalswallet`, {
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

// ---------- PUT /api/metals/wallets  { metal, id, (name|amount|unit) } ----------
export async function PUT(req: NextRequest) {
  const bodyText = await req.text();
  let parsed: any = null;
  try { parsed = JSON.parse(bodyText || "{}"); } catch {}
  if (!parsed || !parsed.metal || !parsed.id) {
    return NextResponse.json(
      { error: "Body must include metal and id; optionally name, amount, unit" },
      { status: 400 }
    );
  }

  const auth = await getAuthHeader(req);
  if (!auth) return NextResponse.json({ error: "Firebase authentication required" }, { status: 401 });
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) headers["authorization"] = auth;

  const upstream = await fetch(`${getApiUrl()}/api/user/metalswallet`, {
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

// ---------- DELETE /api/metals/wallets?id=...&metal=... ----------
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const idQs = searchParams.get("id");
  const metalQs = searchParams.get("metal");

  // Accept JSON body fallback (id/metal) like your crypto delete route does for params
  let bodyText = "";
  if (!idQs || !metalQs) {
    bodyText = await req.text();
    try {
      const parsed = JSON.parse(bodyText || "{}");
      if (!parsed?.id || !parsed?.metal) {
        return NextResponse.json(
          { error: "Provide id and metal (query or JSON body)" },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const auth = await getAuthHeader(req);
  if (!auth) return NextResponse.json({ error: "Firebase authentication required" }, { status: 401 });
  const headers: Record<string, string> = {};
  if (auth) headers["authorization"] = auth;
  if (bodyText) headers["Content-Type"] = "application/json";

  const upstreamUrl = `${getApiUrl()}/api/user/metalswallet${
    idQs && metalQs ? `?id=${encodeURIComponent(idQs)}&metal=${encodeURIComponent(metalQs)}` : ""
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
