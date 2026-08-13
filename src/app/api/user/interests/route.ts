import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

async function getAuthHeader(req: Request) {
  const hdr = req.headers.get("authorization");

  if (hdr?.startsWith("Bearer ")) {
    return hdr;
  }

  const store = await cookies();

  const token =
    store.get("__session")?.value ||
    store.get("idToken")?.value;

  return token ? `Bearer ${token}` : undefined;
}

export async function PUT(req: NextRequest) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const auth = await getAuthHeader(req);

  if (auth) {
    headers.authorization = auth;
  }

  const body = await req.text();

  const upstream = await fetch(
    `${getApiUrl()}/api/user/interests`,
    {
      method: "PUT",
      headers,
      body,
      cache: "no-store",
    }
  );

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