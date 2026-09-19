import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();

    /*
     * Prefer a fresh Firebase ID token supplied by the client.
     * Fall back to the existing __session cookie so current callers
     * continue to work during rollout.
     */
    const authorization =
      req.headers.get("authorization") || "";

    const bearerToken =
      authorization.startsWith("Bearer ")
        ? authorization.slice(7).trim()
        : "";

    const cookieToken =
      cookieStore.get("__session")?.value || "";

    const token =
      bearerToken || cookieToken;

    if (token) {
      const apiUrl = getApiUrl();

      try {
        const response = await fetch(
          `${apiUrl}/api/auth/signout`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            cache: "no-store",
          }
        );

        /*
         * An expired or already-revoked token must not prevent
         * local session cleanup.
         */
        if (!response.ok) {
          console.warn(
            "Backend signout returned:",
            response.status
          );
        }
      } catch (err) {
        console.error(
          "Backend signout error:",
          err
        );
      }
    }
  } catch (err) {
    console.error(
      "Server signout error:",
      err
    );
  }

  /*
   * Always clear local session cookies even when backend revocation
   * fails or the token is already invalid.
   */
  const cookieStore = await cookies();

  cookieStore.delete("__session");
  cookieStore.delete("refreshToken");
  cookieStore.delete("idToken");

  return NextResponse.json({
    message: "Signed out successfully",
  });
}
