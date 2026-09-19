// src/app/api/auth/session/route.ts

import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);

    const idToken =
      typeof body?.idToken === "string"
        ? body.idToken.trim()
        : "";

    if (!idToken) {
      return NextResponse.json(
        {
          error: "idToken required",
          code: "AUTH_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Verify the Firebase ID token before trusting it as the
     * application's HttpOnly session cookie.
     *
     * The backend /api/me route is protected by requireAuth,
     * so a successful response confirms that the token is valid
     * and accepted by the same authentication layer protecting
     * the rest of the API.
     */
    const apiUrl = getApiUrl();

    const verifyResponse = await fetch(
      `${apiUrl}/api/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${idToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    if (!verifyResponse.ok) {
      const verifyData = await verifyResponse
        .json()
        .catch(() => ({}));

      return NextResponse.json(
        {
          error:
            verifyData?.error ||
            "Unable to verify authentication token",
          code:
            verifyData?.code ||
            "AUTH_INVALID",
        },
        {
          status:
            verifyResponse.status === 401 ||
            verifyResponse.status === 403
              ? verifyResponse.status
              : 401,
        }
      );
    }

    const res = NextResponse.json({
      ok: true,
    });

    res.cookies.set(
      "__session",
      idToken,
      {
        httpOnly: true,
        secure:
          process.env.NODE_ENV ===
          "production",
        sameSite: "lax",
        path: "/",

        /*
         * Firebase ID tokens normally expire after about one hour.
         * Keep the local cookie bounded to the same session window.
         */
        maxAge: 60 * 60,
      }
    );

    return res;
  } catch (err) {
    console.error(
      "Session route error:",
      err
    );

    return NextResponse.json(
      {
        error:
          "Unable to establish session",
        code:
          "SESSION_CREATE_FAILED",
      },
      {
        status: 500,
      }
    );
  }
}
