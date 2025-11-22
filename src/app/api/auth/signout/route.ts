// src/app/api/auth/signout/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 60;
export const runtime = "nodejs";

async function getAuthHeader(req: Request) {
  const hdr = req.headers.get("authorization");
  if (hdr?.startsWith("Bearer ")) return hdr;
  const store = await cookies();
  const token = store.get("__session")?.value || store.get("idToken")?.value;
  return token ? `Bearer ${token}` : undefined;
}

export async function POST(req: Request) {
  try {
    const authHeader = await getAuthHeader(req);
    if (!authHeader) {
      return NextResponse.json(
        { error: "Missing or invalid auth token" },
        { status: 401 }
      );
    }

    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/api/auth/signout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || "Signout failed" },
        { status: res.status }
      );
    }

    // Clear session cookies on successful signout
    const cookieStore = await cookies();
    cookieStore.delete("__session");
    cookieStore.delete("idToken");

    return NextResponse.json({ message: "Signed out successfully" });
  } catch (err: any) {
    console.error("Signout error:", err);
    return NextResponse.json(
      { error: err?.message || "Unexpected error during signout" },
      { status: 500 }
    );
  }
}


