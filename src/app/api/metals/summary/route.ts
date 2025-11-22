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

type ChartPoint = { t: string; o?: number; h?: number; l?: number; c?: number };

function nearestIndexForTs(points: ChartPoint[], targetMs: number) {
  let lo = 0, hi = points.length - 1;
  let best = 0, bestDiff = Infinity;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const ts = Date.parse(points[mid].t);
    const diff = Math.abs(ts - targetMs);
    if (diff < bestDiff) { best = mid; bestDiff = diff; }
    if (ts < targetMs) lo = mid + 1; else hi = mid - 1;
  }
  return best;
}

export async function GET(req: NextRequest) {
  try {
    const api = getApiUrl();
    const urlIn = new URL(req.url);
    const sp = urlIn.searchParams;

    const metal = (sp.get("metal") || "").toLowerCase();
    const base = sp.get("base") || BASE_BY_METAL[metal] || "XAU";
    const currency = (sp.get("currency") || "USD").toUpperCase();

    // 1) summary
    const summaryUrl = new URL(`${api}/api/metals/summary`);
    summaryUrl.searchParams.set("base", base);
    summaryUrl.searchParams.set("currency", currency);

    const headers = await buildAuthHeaders(req);
    const summaryRes = await fetch(summaryUrl.toString(), {
      method: "GET",
      cache: "no-store",
      headers,
    });

    if (!summaryRes.ok) {
      const passthrough = await summaryRes.text();
      return new Response(passthrough, {
        status: summaryRes.status,
        headers: { "content-type": summaryRes.headers.get("content-type") || "application/json" },
      });
    }

    const summaryJson = await summaryRes.json();
    const items: any[] = Array.isArray(summaryJson?.items) ? summaryJson.items : [];
    const targetSymbol = `${base}/${currency}`;
    const idx = items.findIndex((it: any) => (it?.symbol || "").toUpperCase() === targetSymbol);

    if (idx === -1) {
      return new Response(JSON.stringify(summaryJson), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    // 2) chart for 3d (we'll compute 24h window from this)
    const chartUrl = new URL(`${api}/api/metals/chart`);
    chartUrl.searchParams.set("symbol", `${base}/${currency}`);
    chartUrl.searchParams.set("range", "3d");

    const chartRes = await fetch(chartUrl.toString(), {
      method: "GET",
      cache: "no-store",
      headers,
    });

    if (chartRes.ok) {
      const chartJson = await chartRes.json();
      const points: ChartPoint[] = Array.isArray(chartJson?.points) ? chartJson.points : [];

      if (points.length >= 2) {
        const last = points[points.length - 1];
        const lastTs = Date.parse(String(last.t));
        if (Number.isFinite(lastTs)) {
          const dayMs = 24 * 60 * 60 * 1000;
          const startTs = lastTs - dayMs;
          const startIdx = nearestIndexForTs(points, startTs);

          let low24 = Number.POSITIVE_INFINITY;
          let high24 = Number.NEGATIVE_INFINITY;

          for (let i = startIdx; i < points.length; i++) {
            const p = points[i];
            const lo = Number(p.l ?? p.c ?? NaN);
            const hi = Number(p.h ?? p.c ?? NaN);
            if (Number.isFinite(lo)) low24 = Math.min(low24, lo);
            if (Number.isFinite(hi)) high24 = Math.max(high24, hi);
          }

          if (Number.isFinite(low24) && Number.isFinite(high24)) {
            items[idx] = {
              ...items[idx],
              low: Number(low24.toFixed(4)),   // inject 24h low
              high: Number(high24.toFixed(4)), // inject 24h high
            };
          }

          // Also keep the change/%change enrichment you already liked:
          const prevIdx = Math.max(0, startIdx);
          const prevClose = Number(points[prevIdx]?.c ?? NaN);
          const lastClose = Number(last.c ?? NaN);
          if (Number.isFinite(prevClose) && prevClose > 0 && Number.isFinite(lastClose)) {
            const change = lastClose - prevClose;
            const percentChange = (change / prevClose) * 100;
            items[idx] = {
              ...items[idx],
              change: Number(change.toFixed(4)),
              percentChange: Number(percentChange.toFixed(4)),
            };
          }
        }
      }
    }

    const enriched = { ...summaryJson, items };
    return new Response(JSON.stringify(enriched), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    console.error("metals/summary proxy error:", err);
    return new Response(JSON.stringify({ error: "Failed to load metals summary" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}
