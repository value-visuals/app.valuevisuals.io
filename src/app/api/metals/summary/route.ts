import { NextRequest } from "next/server";
import { readBearer } from "@/lib/auth/serverBearer";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Base = "XAU" | "XAG";
type Currency = "USD" | "EUR" | "GBP";

const BASES: Record<string, Base> = { gold: "XAU", silver: "XAG" };
const BASES_SET = new Set<Base>(["XAU", "XAG"]);
const CURRENCIES = new Set<Currency>(["USD", "EUR", "GBP"]);

function base(value: string | null): Base {
  const v = String(value || "").trim();
  const upper = v.toUpperCase();
  return BASES_SET.has(upper as Base)
    ? (upper as Base)
    : BASES[v.toLowerCase()] || "XAU";
}

function currency(value: string | null): Currency {
  const v = String(value || "USD").trim().toUpperCase();
  return CURRENCIES.has(v as Currency) ? (v as Currency) : "USD";
}

function authHeaders(req: NextRequest) {
  const auth = readBearer(req);
  return auth ? { accept: "application/json", authorization: auth } : null;
}

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const b = base(params.get("base") || params.get("metal"));
    const c = currency(params.get("currency"));

    const url = new URL(`${getApiUrl()}/api/metals/summary`);
    url.searchParams.set("base", b);
    url.searchParams.set("currency", c);

    const headers = authHeaders(req);
    if (!headers) return Response.json({ error: "Firebase authentication required" }, { status: 401 });
    const response = await fetch(url, {
      cache: "no-store",
      headers,
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
    console.error("[api/metals/summary]", error);

    return Response.json(
      { error: "Failed to load metals summary" },
      { status: 500 }
    );
  }
}
