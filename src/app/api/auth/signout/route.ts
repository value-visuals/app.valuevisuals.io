import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("__session")?.value;

    if (token) {
      const apiUrl = getApiUrl();

      await fetch(`${apiUrl}/api/auth/signout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
    }
  } catch (err) {
    console.error("Server signout error:", err);
  }

  const cookieStore = await cookies();

  cookieStore.delete("__session");
  cookieStore.delete("refreshToken");
  cookieStore.delete("idToken");

  return NextResponse.json({
    message: "Signed out successfully",
  });
}