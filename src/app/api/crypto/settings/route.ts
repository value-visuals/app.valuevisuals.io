import { readBearer } from "@/lib/auth/serverBearer";
// src/app/api/crypto/settings/route.ts
import { NextRequest, NextResponse } from "next/server";

import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

// Same auth approach as your bitcoin/portfolio routes
async function getAuthHeader(req: Request) {
  return readBearer(req);
}

// PUT /api/crypto/settings  →  PUT {API_BASE}/api/user/email/mirror
export async function PUT(req: NextRequest) {
  const headers: Record<string, string> = {};
  const auth = await getAuthHeader(req);
  if (!auth) return NextResponse.json({ error: "Firebase authentication required" }, { status: 401 });
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
