import { NextRequest, NextResponse } from "next/server";

export const revalidate = 60;

const COINGECKO_API =
  "https://api.coingecko.com/api/v3";

type PricePoint = {
  t: number;
  price: number;
};

const COIN_IDS: Record<string, string> = {
  bitcoin: "bitcoin",
  ethereum: "ethereum",
  monero: "monero",
};

function normalizeCoin(value: string | null) {
  const coin = String(value || "").toLowerCase();

  return COIN_IDS[coin] ? coin : null;
}

function normalizeDays(value: string | null) {
  const allowed = [
    "1",
    "2",
    "3",
    "7",
    "14",
    "30",
    "60",
    "90",
    "180",
    "365",
  ];

  const days = String(value || "30");

  return allowed.includes(days) ? days : "30";
}

function toPricePoints(data: any): PricePoint[] {
  if (!Array.isArray(data?.prices)) {
    return [];
  }

  return data.prices
    .map((point: [number, number]) => ({
      t: Number(point[0]),
      price: Number(point[1]),
    }))
    .filter(
      (point: PricePoint) =>
        Number.isFinite(point.t) &&
        Number.isFinite(point.price) &&
        point.price > 0
    )
    .sort((a: PricePoint, b: PricePoint) => a.t - b.t);
}

/**
 * Find the closest quote price to a base timestamp.
 *
 * CoinGecko normally returns similarly spaced timestamps for both
 * assets, but they are not guaranteed to be byte-for-byte identical.
 */
function findClosestPrice(
  points: PricePoint[],
  targetTime: number,
  maxDifferenceMs: number
): number | null {
  if (!points.length) {
    return null;
  }

  let low = 0;
  let high = points.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const time = points[mid].t;

    if (time === targetTime) {
      return points[mid].price;
    }

    if (time < targetTime) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const candidates: PricePoint[] = [];

  if (low < points.length) {
    candidates.push(points[low]);
  }

  if (high >= 0) {
    candidates.push(points[high]);
  }

  let closest: PricePoint | null = null;
  let smallestDifference = Infinity;

  for (const candidate of candidates) {
    const difference = Math.abs(candidate.t - targetTime);

    if (difference < smallestDifference) {
      smallestDifference = difference;
      closest = candidate;
    }
  }

  if (!closest || smallestDifference > maxDifferenceMs) {
    return null;
  }

  return closest.price;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const base = normalizeCoin(searchParams.get("base"));
  const quote = normalizeCoin(searchParams.get("quote"));
  const days = normalizeDays(searchParams.get("days"));

  if (!base || !quote) {
    return NextResponse.json(
      {
        error:
          "Invalid base or quote coin. Supported coins: bitcoin, ethereum, monero.",
      },
      { status: 400 }
    );
  }

  if (base === quote) {
    return NextResponse.json(
      {
        error: "Base and quote coins must be different.",
      },
      { status: 400 }
    );
  }

  const baseId = COIN_IDS[base];
  const quoteId = COIN_IDS[quote];

  const baseUrl =
    `${COINGECKO_API}/coins/${baseId}/market_chart` +
    `?vs_currency=usd&days=${days}`;

  const quoteUrl =
    `${COINGECKO_API}/coins/${quoteId}/market_chart` +
    `?vs_currency=usd&days=${days}`;

  try {
    const [baseResponse, quoteResponse] =
      await Promise.all([
        fetch(baseUrl, {
          next: { revalidate },
        }),
        fetch(quoteUrl, {
          next: { revalidate },
        }),
      ]);

    if (!baseResponse.ok || !quoteResponse.ok) {
      const baseStatus = baseResponse.status;
      const quoteStatus = quoteResponse.status;

      console.error(
        "[/api/crypto/comparison] CoinGecko request failed:",
        {
          base,
          quote,
          baseStatus,
          quoteStatus,
        }
      );

      return NextResponse.json(
        {
          error: "Unable to retrieve comparison data from CoinGecko.",
          prices: [],
        },
        { status: 502 }
      );
    }

    const [baseData, quoteData] =
      await Promise.all([
        baseResponse.json(),
        quoteResponse.json(),
      ]);

    const basePoints = toPricePoints(baseData);
    const quotePoints = toPricePoints(quoteData);

    if (!basePoints.length || !quotePoints.length) {
      return NextResponse.json(
        {
          base,
          quote,
          pair: `${base}/${quote}`,
          days: Number(days),
          prices: [],
        },
        { status: 200 }
      );
    }

    /*
     * We use the base asset's timestamps and find the nearest
     * quote price for each timestamp.
     *
     * The tolerance is intentionally generous enough to handle
     * CoinGecko's slightly different sampling timestamps while
     * preventing us from pairing completely unrelated observations.
     */
    const maxDifferenceMs =
      Number(days) <= 3
        ? 30 * 60 * 1000
        : Number(days) <= 30
          ? 3 * 60 * 60 * 1000
          : 12 * 60 * 60 * 1000;

    const prices = basePoints
      .map((basePoint) => {
        const quotePrice = findClosestPrice(
          quotePoints,
          basePoint.t,
          maxDifferenceMs
        );

        if (
          quotePrice === null ||
          !Number.isFinite(basePoint.price) ||
          basePoint.price <= 0
        ) {
          return null;
        }

        const ratio =
          basePoint.price / quotePrice;

        if (!Number.isFinite(ratio) || ratio <= 0) {
          return null;
        }

        return {
          t: basePoint.t,
          price: ratio,
          basePriceUsd: basePoint.price,
          quotePriceUsd: quotePrice,
        };
      })
      .filter(Boolean);

    const cleanPrices = prices as Array<{
      t: number;
      price: number;
      basePriceUsd: number;
      quotePriceUsd: number;
    }>;

    const latest =
      cleanPrices.length > 0
        ? cleanPrices[cleanPrices.length - 1]
        : null;

    return NextResponse.json({
      base,
      quote,
      pair: `${base}/${quote}`,
      days: Number(days),
      prices: cleanPrices,
      current: latest?.price ?? null,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error(
      "[/api/crypto/comparison] fetch failed:",
      err
    );

    return NextResponse.json(
      {
        error: "Unable to retrieve comparison data.",
        prices: [],
      },
      { status: 500 }
    );
  }
}