import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { idToken } = await req.json();

    if (!idToken) {
      return NextResponse.json(
        { error: "idToken required" },
        { status: 400 }
      );
    }

    const res = NextResponse.json({ ok: true });

    res.cookies.set("__session", idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",

      // Firebase ID tokens are ~1 hour.
      // Keep the cookie alive slightly longer than that.
      maxAge: 60 * 60,
    });

    return res;
  } catch (err) {
    console.error("Session route error:", err);

    return NextResponse.json(
      { error: "Unable to establish session" },
      { status: 500 }
    );
  }
}