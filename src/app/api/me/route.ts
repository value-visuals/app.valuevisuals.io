import { readBearer } from "@/lib/auth/serverBearer";
import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

async function getAuthHeader(req: Request) {
  return readBearer(req);
}

export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {};

  const auth = await getAuthHeader(req);
  if (!auth) return NextResponse.json({ error: "Firebase authentication required" }, { status: 401 });

  if (auth) {
    headers.authorization = auth;
  }

  const upstream = await fetch(`${getApiUrl()}/api/me`, {
    method: "GET",
    headers,
    cache: "no-store",
  });

  const text = await upstream.text();

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "Content-Type":
        upstream.headers.get("Content-Type") ||
        "application/json",
    },
  });
}