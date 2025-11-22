// app/api/auth/signup/route.ts
import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/getApiUrl";

export async function POST(req: Request) {
  const API_BASE = getApiUrl();

  try {
    const body = await req.json();
    const r = await fetch(`${API_BASE}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const j = await r.json().catch(() => ({}));

    // Be tolerant to backend field names: customToken | custom_token | token
    const customToken =
      j?.customToken || j?.custom_token || j?.token || null;

    if (!r.ok || !customToken) {
      return NextResponse.json(
        { error: j?.error || "Backend did not return customToken" },
        { status: r.status || 400 }
      );
    }

    // Pass it back to the browser to exchange using firebase/auth
    return NextResponse.json({ customToken, uid: j?.uid ?? null });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Signup proxy failed" },
      { status: 500 }
    );
  }
}
