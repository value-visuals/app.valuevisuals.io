import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Base = "XAU" | "XAG";
type Currency = "USD" | "EUR" | "GBP";
type Cookie = { value: string };

const BASES: Record<string, Base> = { gold: "XAU", silver: "XAG" };
const BASES_SET = new Set<Base>(["XAU", "XAG"]);
const CURRENCIES = new Set<Currency>(["USD", "EUR", "GBP"]);

async function cookieStore() {
  const c = cookies() as any;
  return typeof c?.then === "function" ? await c : c;
}

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

async function authHeaders(req: NextRequest) {
  const headers: Record<string, string> = {
    accept: "application/json",
  };

  const auth = req.headers.get("authorization");

  if (auth) {
    headers.authorization = auth;
  } else {
    const jar = await cookieStore();

    let token =
      jar.get("authToken")?.value ||
      jar.get("token")?.value ||
      jar.get("jwt")?.value ||
      jar.get("access_token")?.value ||
      jar.get("Authorization")?.value;

    token ||= jar
      .getAll()
      .find(
        (c: Cookie) =>
          c.value.split(".").length === 3
      )?.value;

    if (token) {
      headers.authorization = token.startsWith("Bearer ")
        ? token
        : `Bearer ${token}`;
      headers["x-auth-token"] =
        headers.authorization.replace(/^Bearer\s+/i, "");
    }
  }

  const cookie = req.headers.get("cookie");
  if (cookie) headers.cookie = cookie;

  return headers;
}

export async function GET(req: NextRequest) {
  try {
    const params = new URL(req.url).searchParams;
    const b = base(params.get("base") || params.get("metal"));
    const c = currency(params.get("currency"));

    const url = new URL(`${getApiUrl()}/api/metals/summary`);
    url.searchParams.set("base", b);
    url.searchParams.set("currency", c);

    const response = await fetch(url, {
      cache: "no-store",
      headers: await authHeaders(req),
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
