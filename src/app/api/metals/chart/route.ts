// src/app/api/metals/chart/routes.ts

import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

import {
  normalizeChartRange,
  getProviderRange,
} from "@/lib/market/chartWindow";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* -------------------------------------------------------------------------- */
/* Auth helpers                                                               */
/* -------------------------------------------------------------------------- */

async function getCookieStore() {
  const maybe = cookies() as any;
  return typeof maybe?.then === "function" ? await maybe : maybe;
}

function looksLikeJwt(value: string): boolean {
  return value.split(".").length === 3;
}

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
      for (const cookie of jar.getAll()) {
        if (typeof cookie.value === "string" && looksLikeJwt(cookie.value)) {
          token = cookie.value;
          break;
        }
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

/* -------------------------------------------------------------------------- */
/* Metal mapping                                                              */
/* -------------------------------------------------------------------------- */

const BASE_BY_METAL: Record<string, "XAU" | "XAG" | "XPT" | "XPD"> = {
  gold: "XAU",
  silver: "XAG",
  platinum: "XPT",
  palladium: "XPD",
};

/* -------------------------------------------------------------------------- */
/* GET                                                                        */
/* -------------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const api = getApiUrl();
    const urlIn = new URL(req.url);
    const sp = urlIn.searchParams;

    /* ---------------------------------------------------------------------- */
    /* Incoming frontend parameters                                           */
    /* ---------------------------------------------------------------------- */

    const metal = (sp.get("metal") || "").toLowerCase();

    const base = (
      sp.get("base") ||
      BASE_BY_METAL[metal] ||
      "XAU"
    ).toUpperCase();

    const currency = (sp.get("currency") || "USD").toUpperCase();

    /*
     * Normalize the frontend range.
     *
     * Invalid ranges become 30d.
     */
    const range = normalizeChartRange(sp.get("range"));

    /*
     * IMPORTANT:
     *
     * We do not pass 1d / 2d / 3d directly upstream.
     *
     * Those ranges are trading-session concepts for our application.
     *
     * Upstream gets 7d so that a weekend request can still retrieve
     * Friday's data.
     */
    const providerRange = getProviderRange(range);

    /* ---------------------------------------------------------------------- */
    /* Backend URL                                                            */
    /* ---------------------------------------------------------------------- */

    const url = new URL(`${api}/api/metals/chart`);

    url.searchParams.set("symbol", `${base}/${currency}`);
    url.searchParams.set("range", providerRange);

    /*
     * Preserve optional provider-specific parameters.
     */
    for (const key of ["interval", "outputsize", "timezone", "order"]) {
      const value = sp.get(key);
      if (value) url.searchParams.set(key, value);
    }

    /* ---------------------------------------------------------------------- */
    /* Request                                                                */
    /* ---------------------------------------------------------------------- */

    const response = await fetch(url.toString(), {
      method: "GET",
      cache: "no-store",
      headers: await buildAuthHeaders(req),
    });

    const body = await response.text();

    /*
     * Pass through the backend response.
     *
     * We intentionally do not modify the actual market points here.
     *
     * The provider returns real market observations.
     * The frontend determines which observations belong to the selected
     * trading-aware display range.
     */
    return new Response(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "application/json",
      },
    });
  } catch (error) {
    console.error("metals/chart proxy error:", error);

    return new Response(
      JSON.stringify({ error: "Failed to load metals chart" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
