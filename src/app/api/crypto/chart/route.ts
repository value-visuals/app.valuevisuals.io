import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

async function getAuthHeader(req: Request) {
  const hdr = req.headers.get("authorization");

  if (hdr?.startsWith("Bearer ")) {
    return hdr;
  }

  const store = await cookies();

  const token =
    store.get("__session")?.value ||
    store.get("idToken")?.value;

  return token ? `Bearer ${token}` : undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const coin =
    searchParams.get("coin") || "bitcoin";

  const days =
    searchParams.get("days") || "30";

  const currency =
    searchParams.get("currency") || "usd";

  /*
   * --------------------------------------------------
   * 1. ALWAYS TRY COINGECKO FIRST
   * --------------------------------------------------
   */

  const coinGeckoUrl =
    `https://api.coingecko.com/api/v3/coins/${coin}/market_chart` +
    `?vs_currency=${encodeURIComponent(currency)}` +
    `&days=${encodeURIComponent(days)}`;

  try {
    const cgRes = await fetch(coinGeckoUrl, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    if (cgRes.ok) {
      const data = await cgRes.json();

      return NextResponse.json(data, {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate",
        },
      });
    }

    /*
     * CoinGecko failed.
     *
     * Do NOT return the error yet.
     * Fall through to the Node backend.
     */

    console.warn(
      `[/api/crypto/chart] CoinGecko failed: ${cgRes.status}`
    );
  } catch (err) {
    console.warn(
      "[/api/crypto/chart] CoinGecko request failed:",
      err
    );
  }

  /*
   * --------------------------------------------------
   * 2. COINGECKO FAILED → NODE BACKEND
   * --------------------------------------------------
   */

  try {
    const API_BASE = getApiUrl();

    const auth = await getAuthHeader(req);

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Missing Authorization bearer token",
        },
        { status: 401 }
      );
    }

    const symbolMap: Record<string, string> = {
      bitcoin: "BTC",
      ethereum: "ETH",
      monero: "XMR",
    };

    const symbol =
      symbolMap[coin.toLowerCase()] ||
      coin.toUpperCase();

    const backendUrl =
      `${API_BASE}/api/crypto/chart` +
      `?symbol=${encodeURIComponent(symbol)}` +
      `&range=${encodeURIComponent(`${days}d`)}` +
      `&interval=auto` +
      `&currency=${encodeURIComponent(currency.toUpperCase())}`;

    const backendRes = await fetch(
      backendUrl,
      {
        cache: "no-store",
        headers: {
          Authorization: auth,
          Accept: "application/json",
        },
      }
    );

    const backendData =
      await backendRes.json().catch(() => ({
        error: "Invalid backend response",
      }));

    if (!backendRes.ok) {
      return NextResponse.json(
        backendData,
        {
          status: backendRes.status,
        }
      );
    }

    /*
     * Backend returns:
     *
     * {
     *   candles: [
     *     { t, o, h, l, c }
     *   ]
     * }
     *
     * Your PriceChart already understands this shape.
     */

    return NextResponse.json(
      backendData,
      { status: 200 }
    );
  } catch (err: any) {
    console.error(
      "[/api/crypto/chart] backend fallback failed:",
      err?.message || err
    );

    return NextResponse.json(
      {
        error: "Chart providers unavailable",
        detail: err?.message || String(err),
      },
      { status: 502 }
    );
  }
}