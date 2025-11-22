import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/getApiUrl";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const API_BASE = getApiUrl();
    const r = await fetch(`${API_BASE}/api/auth/signin`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await r.json();
    if (!r.ok) {
      return NextResponse.json({ error: "Sign in failed", detail: data }, { status: r.status });
    }

    // Backend returns: { uid, idToken, refreshToken, expiresIn }
    const idToken = data.idToken as string | undefined;
    const refreshToken = data.refreshToken as string | undefined;
    const expiresInSec = Math.max(60, Number(data.expiresIn || 3600)); // default 1h

    if (!idToken) {
      return NextResponse.json({ error: "No idToken in response" }, { status: 500 });
    }

    const res = NextResponse.json({ uid: data.uid, expiresIn: expiresInSec });

    // Set HttpOnly session cookie with the ID token so your other routes can read it
    res.cookies.set("__session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.min(expiresInSec, 55 * 60), // ~55m to renew before expiry
    });

    // (Optional) store refresh token for a future refresh endpoint
    if (refreshToken) {
      res.cookies.set("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
    }

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: "Sign in route error", detail: err?.message }, { status: 500 });
  }
}
