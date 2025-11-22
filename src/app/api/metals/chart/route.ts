import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function getCookieStore() {
  const maybe = cookies() as any;
  return typeof maybe?.then === "function" ? await maybe : maybe;
}
function looksLikeJwt(s: string) { return s.split(".").length === 3; }

async function buildAuthHeaders(req: NextRequest): Promise<Record<string, string>> {
  const headers: Record<string, string> = { accept: "application/json" };

  const reqAuth = req.headers.get("authorization");
  if (reqAuth) {
    headers.authorization = reqAuth;
  } else {
    const jar = await getCookieStore();
    const known =
      jar.get("authToken")?.value ||
      jar.get("token")?.value ||
      jar.get("jwt")?.value ||
      jar.get("access_token")?.value ||
      jar.get("Authorization")?.value;

    let token = known;
    if (!token) {
      for (const c of jar.getAll()) {
        if (typeof c.value === "string" && looksLikeJwt(c.value)) { token = c.value; break; }
      }
    }
    if (token) {
      headers.authorization = token.startsWith("Bearer ") ? token : `Bearer ${token}`;
      headers["x-auth-token"] = headers.authorization.replace(/^Bearer\s+/i, "");
    }
  }

  const cookieHeader = req.headers.get("cookie");
  if (cookieHeader) headers.cookie = cookieHeader;

  return headers;
}

const BASE_BY_METAL: Record<string, "XAU" | "XAG" | "XPT" | "XPD"> = {
  gold: "XAU",
  silver: "XAG",
  platinum: "XPT",
  palladium: "XPD",
};

export async function GET(req: NextRequest) {
  try {
    const api = getApiUrl();
    const urlIn = new URL(req.url);
    const sp = urlIn.searchParams;

    // Translate front-end query to backend expectations
    const metal = (sp.get("metal") || "").toLowerCase();
    const base = sp.get("base") || BASE_BY_METAL[metal] || "XAU";
    const currency = (sp.get("currency") || "USD").toUpperCase();
    const range = (sp.get("range") || "30d").toLowerCase();

    // Rebuild query for backend (symbol=XAU/USD, drop metal & days)
    const url = new URL(`${api}/api/metals/chart`);
    url.searchParams.set("symbol", `${base}/${currency}`);
    url.searchParams.set("range", range);

    // Optional passthroughs if you ever add them
    for (const key of ["interval", "outputsize", "timezone", "order"]) {
      const v = sp.get(key);
      if (v) url.searchParams.set(key, v);
    }

    const r = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: await buildAuthHeaders(req),
    });

    const body = await r.text(); // pass-through
    return new Response(body, {
      status: r.status,
      headers: { "content-type": r.headers.get("content-type") || "application/json" },
    });
  } catch (err) {
    console.error("metals/chart proxy error:", err);
    return new Response(JSON.stringify({ error: "Failed to load metals chart" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
