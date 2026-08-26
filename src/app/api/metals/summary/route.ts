import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASES = { gold: "XAU", silver: "XAG" } as const;
const SUPPORTED_BASES = new Set(["XAU", "XAG"]);
const SUPPORTED_CURRENCIES = new Set(["USD", "EUR", "GBP"]);

async function getCookieStore() {
  const store = cookies() as any;
  return typeof store?.then === "function" ? await store : store;
}

function normalizeBase(value: string | null): "XAU" | "XAG" {
  const v = String(value || "").trim().toUpperCase();
  if (SUPPORTED_BASES.has(v)) return v as "XAU" | "XAG";
  return BASES[String(value || "").trim().toLowerCase() as keyof typeof BASES] || "XAU";
}

function normalizeCurrency(value: string | null): "USD" | "EUR" | "GBP" {
  const v = String(value || "USD").trim().toUpperCase();
  return SUPPORTED_CURRENCIES.has(v) ? v as "USD" | "EUR" | "GBP" : "USD";
}

async function buildAuthHeaders(req: NextRequest) {
  const headers: Record<string, string> = { accept: "application/json" };
  const auth = req.headers.get("authorization");

  if (auth) {
    headers.authorization = auth;
  } else {
    const jar = await getCookieStore();
    let token =
      jar.get("authToken")?.value ||
      jar.get("token")?.value ||
      jar.get("jwt")?.value ||
      jar.get("access_token")?.value ||
      jar.get("Authorization")?.value;

    if (!token) {
      token = jar
        .getAll()
        .find(c => typeof c.value === "string" && c.value.split(".").length === 3)
        ?.value;
    }

    if (token) {
      headers.authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
      headers["x-auth-token"] = headers.authorization.replace(
        /^Bearer\s+/i,
        ""
      );
    }
  }

  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const incoming = new URL(req.url);
    const params = incoming.searchParams;

    const base = normalizeBase(
      params.get("base") || params.get("metal")
    );

    const currency = normalizeCurrency(
      params.get("currency")
    );

    const backend = new URL(
      `${getApiUrl()}/api/metals/summary`
    );

    backend.searchParams.set("base", base);
    backend.searchParams.set("currency", currency);

    const response = await fetch(backend, {
      method: "GET",
      cache: "no-store",
      headers: await buildAuthHeaders(req),
    });

    return new Response(await response.text(), {
      status: response.status,
      headers: {
        "content-type":
          response.headers.get("content-type") ||
          "application/json",
      },
    });
  } catch (error) {
    console.error("[api/metals/summary] proxy error:", error);

    return new Response(
      JSON.stringify({ error: "Failed to load metals summary" }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
}
