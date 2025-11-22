// src/app/api/crypto/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 60;
export const runtime = "nodejs";

// Same auth approach as your bitcoin/portfolio routes
async function getAuthHeader(req: Request) {
  const hdr = req.headers.get("authorization");
  if (hdr?.startsWith("Bearer ")) return hdr;
  const store = await cookies();
  const token = store.get("__session")?.value || store.get("idToken")?.value;
  return token ? `Bearer ${token}` : undefined;
}

// PUT /api/crypto/settings  →  PUT {API_BASE}/api/user/email/mirror
export async function PUT(req: NextRequest) {
  const headers: Record<string, string> = {};
  const auth = await getAuthHeader(req);
  if (auth) headers["authorization"] = auth;

  const upstream = await fetch(`${getApiUrl()}/api/user/email/mirror`, {
    method: "PUT",
    headers,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") || "application/json",
    },
  });
}
