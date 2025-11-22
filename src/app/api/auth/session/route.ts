// app/api/auth/session/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { idToken, refreshToken, expiresIn } = await req.json();

    if (!idToken) {
      return NextResponse.json({ error: "idToken required" }, { status: 400 });
    }

    // Default to 1 hour if not specified
    const maxAgeSec =
      typeof expiresIn === "number"
        ? Math.max(1, Math.floor(expiresIn))
        : 3600;

    const res = NextResponse.json({ ok: true });

    // Mirror your sign-in semantics
    res.cookies.set("__session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Math.min(maxAgeSec, 55 * 60), // keep some headroom
    });

    if (refreshToken) {
      res.cookies.set("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return res;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Session route error" },
      { status: 500 }
    );
  }
}
