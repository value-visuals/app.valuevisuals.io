// src/app/api/crypto/summary/route.ts

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 60;
export const runtime = "nodejs";

async function getAuthHeader(req: Request) {
  const hdr =
    req.headers.get("authorization");

  if (hdr?.startsWith("Bearer ")) {
    return hdr;
  }

  const store = await cookies();

  const token =
    store.get("__session")?.value ||
    store.get("idToken")?.value ||
    undefined;

  return token
    ? `Bearer ${token}`
    : undefined;
}

export async function GET(req: Request) {
  try {
    const API_BASE = getApiUrl();
    const auth = await getAuthHeader(req);

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Missing Authorization bearer token",
        },
        {
          status: 401,
        }
      );
    }

    const { searchParams } =
      new URL(req.url);

    const symbols =
      searchParams.get("symbols") ??
      "BTC,ETH,XMR";

    const currency =
      (
        searchParams.get("currency") ??
        "USD"
      ).toUpperCase();

    const curKey =
      currency.toLowerCase();

    const [
      summaryRes,
      globalRes,
    ] = await Promise.all([
      fetch(
        `${API_BASE}/api/crypto/summary?symbols=${encodeURIComponent(
          symbols
        )}&currency=${encodeURIComponent(
          currency
        )}`,
        {
          headers: {
            Authorization: auth,
          },

          // @ts-ignore
          next: {
            revalidate,
          },
        }
      ),

      fetch(
        `${API_BASE}/api/crypto/global?currency=${encodeURIComponent(
          currency
        )}`,
        {
          headers: {
            Authorization: auth,
          },

          // @ts-ignore
          next: {
            revalidate,
          },
        }
      ),
    ]);

    if (!summaryRes.ok) {
      throw new Error(
        `Crypto summary request failed: ${summaryRes.status}`
      );
    }

    const summary =
      await summaryRes.json();

    const global =
      globalRes.ok
        ? await globalRes.json()
        : null;

    const slugMap: Record<
      string,
      string
    > = {
      BTC: "bitcoin",
      ETH: "ethereum",
      XMR: "monero",
    };

    const out: Record<
      string,
      any
    > = {};

    for (
      const row of
        summary?.data ?? []
    ) {
      const sym =
        String(
          row?.symbol ?? ""
        ).toUpperCase();

      const slug =
        slugMap[sym] ??
        sym.toLowerCase();

      /*
       * PRICE
       *
       * Prefer the backend's currency-aware
       * `price` field.
       */
      const price =
        typeof row?.price ===
        "number"
          ? row.price
          : typeof row?.priceUsd ===
              "number"
            ? row.priceUsd
            : null;

      /*
       * MARKET CAP
       *
       * Prefer currency-aware `marketCap`.
       */
      const marketCap =
        typeof row?.marketCap ===
        "number"
          ? row.marketCap
          : typeof row?.marketCapUsd ===
              "number"
            ? row.marketCapUsd
            : null;

      /*
       * 24H VOLUME
       *
       * Prefer currency-aware `volume24h`.
       */
      const volume24h =
        typeof row?.volume24h ===
        "number"
          ? row.volume24h
          : typeof row?.volume24hUsd ===
              "number"
            ? row.volume24hUsd
            : null;

      /*
       * 24H CHANGE
       */
      const change24hPct =
        row?.change24hPct != null
          ? Number(
              row.change24hPct
            )
          : null;

      const change24h =
        row?.change24h != null
          ? Number(
              row.change24h
            )
          : change24hPct != null
            ? change24hPct / 100
            : null;

      /*
       * DOMINANCE
       */
      const dominancePct =
        row?.dominancePct != null
          ? Number(
              row.dominancePct
            )
          : null;

      /*
       * Keep the existing price shape
       * that your dashboard already uses.
       */
      out[slug] = {
        [curKey]: price,
      };

      /*
       * Add currency-aware stats for
       * the individual crypto pages.
       */
      out[`${slug}_stats`] = {
        price,
        marketCap,
        volume24h,
        change24h,
        change24hPct,
        dominancePct,
      };
    }

    /*
     * Global market cap.
     */
    const globalMarketCap =
      typeof global?.marketCap ===
      "number"
        ? global.marketCap
        : typeof global?.marketCapUsd ===
            "number"
          ? global.marketCapUsd
          : null;

    out.global_market_cap = {
      [curKey]:
        globalMarketCap,
    };

    return NextResponse.json(
      out,
      {
        status: 200,
      }
    );
  } catch (err: any) {
    console.error(
      "[/api/crypto/summary] proxy failed:",
      err?.message || err
    );

    return NextResponse.json(
      {
        error: "Failed",
        detail:
          err?.message,
      },
      {
        status: 500,
      }
    );
  }
}