// app/api/crypto/chart/route.ts

import {
  NextRequest,
  NextResponse,
} from "next/server";

import { cookies } from "next/headers";

import { getApiUrl } from "@/lib/getApiUrl";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;
export const runtime = "nodejs";

// -----------------------------------------------------------------------------
// Configuration
// -----------------------------------------------------------------------------

const SUPPORTED_SYMBOLS = new Set([
  "BTC",
  "ETH",
  "XMR",
]);

const SUPPORTED_CURRENCIES = new Set([
  "USD",
  "EUR",
  "GBP",
]);

// -----------------------------------------------------------------------------
// Authentication
// -----------------------------------------------------------------------------

async function getAuthHeader(
  req: Request
) {
  /*
   * Prefer the Authorization header sent
   * by authenticatedFetch().
   */
  const header =
    req.headers.get("authorization");

  if (
    header?.startsWith("Bearer ")
  ) {
    return header;
  }

  /*
   * Fallback for requests where the token
   * is stored in the session cookie.
   */
  const store = await cookies();

  const token =
    store.get("__session")?.value ||
    store.get("idToken")?.value;

  return token
    ? `Bearer ${token}`
    : undefined;
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function normalizeSymbol(
  coin: string
) {
  const value = String(
    coin || ""
  )
    .trim()
    .toLowerCase();

  const symbolMap: Record<
    string,
    string
  > = {
    bitcoin: "BTC",
    btc: "BTC",

    ethereum: "ETH",
    eth: "ETH",

    monero: "XMR",
    xmr: "XMR",
  };

  return (
    symbolMap[value] ||
    value.toUpperCase()
  );
}

function normalizeCurrency(
  currency: string
) {
  const value = String(
    currency || "USD"
  )
    .trim()
    .toUpperCase();

  return SUPPORTED_CURRENCIES.has(
    value
  )
    ? value
    : "USD";
}

function normalizeDays(
  days: string
) {
  const value = Number(days);

  if (
    !Number.isFinite(value) ||
    value <= 0
  ) {
    return 30;
  }

  /*
   * Prevent accidentally enormous
   * Firestore requests.
   */
  return Math.min(
    Math.floor(value),
    3650
  );
}

// -----------------------------------------------------------------------------
// GET /api/crypto/chart
//
// Frontend examples:
//
// /api/crypto/chart?coin=bitcoin&days=30&currency=usd
// /api/crypto/chart?coin=ethereum&days=7&currency=eur
// /api/crypto/chart?coin=monero&days=30&currency=gbp
//
// Backend:
//
// /api/crypto/chart
//   ?symbol=BTC
//   &range=30d
//   &interval=auto
//   &currency=USD
// -----------------------------------------------------------------------------

export async function GET(
  req: NextRequest
) {
  try {
    const {
      searchParams,
    } = new URL(req.url);

    // -------------------------------------------------------------------------
    // Request parameters
    // -------------------------------------------------------------------------

    const coin =
      searchParams.get("coin") ||
      "bitcoin";

    const days =
      normalizeDays(
        searchParams.get("days") ||
          "30"
      );

    const currency =
      normalizeCurrency(
        searchParams.get(
          "currency"
        ) || "USD"
      );

    // -------------------------------------------------------------------------
    // Map frontend asset → backend symbol
    // -------------------------------------------------------------------------

    const symbol =
      normalizeSymbol(coin);

    // -------------------------------------------------------------------------
    // Validate symbol
    // -------------------------------------------------------------------------

    if (
      !SUPPORTED_SYMBOLS.has(
        symbol
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Unsupported crypto asset: ${symbol}. ` +
            "Supported assets: BTC, ETH, XMR.",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------------------------------
    // Validate currency
    // -------------------------------------------------------------------------

    if (
      !SUPPORTED_CURRENCIES.has(
        currency
      )
    ) {
      return NextResponse.json(
        {
          error:
            `Unsupported currency: ${currency}. ` +
            "Supported currencies: USD, EUR, GBP.",
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------------------------------
    // Authentication
    // -------------------------------------------------------------------------

    const auth =
      await getAuthHeader(req);

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

    // -------------------------------------------------------------------------
    // Backend URL
    // -------------------------------------------------------------------------

    const API_BASE =
      getApiUrl();

    const backendUrl =
      new URL(
        "/api/crypto/chart",
        API_BASE
      );

    backendUrl.searchParams.set(
      "symbol",
      symbol
    );

    backendUrl.searchParams.set(
      "range",
      `${days}d`
    );

    backendUrl.searchParams.set(
      "interval",
      "auto"
    );

    backendUrl.searchParams.set(
      "currency",
      currency
    );

    // -------------------------------------------------------------------------
    // Call Node backend
    // -------------------------------------------------------------------------

    console.log(
      "[/api/crypto/chart] requesting backend:",
      backendUrl.toString()
    );

    const backendResponse =
      await fetch(
        backendUrl.toString(),
        {
          method: "GET",

          cache: "no-store",

          headers: {
            Authorization: auth,
            Accept:
              "application/json",
          },
        }
      );

    // -------------------------------------------------------------------------
    // Read backend response
    // -------------------------------------------------------------------------

    const data =
      await backendResponse
        .json()
        .catch(() => null);

    // -------------------------------------------------------------------------
    // Backend error
    // -------------------------------------------------------------------------

    if (
      !backendResponse.ok
    ) {
      console.error(
        "[/api/crypto/chart] backend returned error:",
        {
          status:
            backendResponse.status,
          symbol,
          currency,
          days,
          data,
        }
      );

      return NextResponse.json(
        data || {
          error:
            "Crypto chart backend request failed",
        },
        {
          status:
            backendResponse.status,
        }
      );
    }

    // -------------------------------------------------------------------------
    // Validate response
    // -------------------------------------------------------------------------

    if (
      !data ||
      typeof data !== "object"
    ) {
      console.error(
        "[/api/crypto/chart] invalid backend response"
      );

      return NextResponse.json(
        {
          error:
            "Invalid backend chart response",
        },
        {
          status: 502,
        }
      );
    }

    // -------------------------------------------------------------------------
    // Return Firebase-backed chart data
    // -------------------------------------------------------------------------

    return NextResponse.json(
      data,
      {
        status: 200,

        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma:
            "no-cache",
          Expires:
            "0",
        },
      }
    );
  } catch (error: any) {
    console.error(
      "[/api/crypto/chart] backend request failed:",
      error?.message ||
        error
    );

    return NextResponse.json(
      {
        error:
          "Chart backend unavailable",

        detail:
          error?.message ||
          String(error),
      },
      {
        status: 502,
      }
    );
  }
}