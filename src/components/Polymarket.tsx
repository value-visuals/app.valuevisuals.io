"use client";

import useSWR from "swr";
import Link from "next/link";
import React, { useMemo, useState } from "react";

type LivePrice = {
  buy: string | null;
  sell: string | null;
};

type Market = {
  eventSlug: string;
  marketSlug: string;
  question: string;
  outcomes: string[] | string | null;
  gammaOutcomePrices: number[] | string | number | null;
  clobTokenIds: string[] | unknown;
  livePrices?: Record<string, LivePrice> | null;
  volume24hr: number | string | null;
  liquidity: number | string | null;
  endDate: string | null;
  url: string;
};

type ApiResponse = {
  count: number;
  data: Market[];
};

type Direction = "bullish" | "bearish" | "neutral";

type AnalyzedMarket = Market & {
  probability: number | null;
  weight: number;
  direction: Direction;
  signal: number;
};

type MarketAnalysis = {
  sentiment: Direction;
  score: number;
  confidence: number;
  bullishMarkets: number;
  bearishMarkets: number;
  neutralMarkets: number;
  totalMarkets: number;
  weightedMarkets: AnalyzedMarket[];
  strongestSignal: AnalyzedMarket | null;
  mostActive: AnalyzedMarket | null;
  highestLiquidity: AnalyzedMarket | null;
  insight: string;
};

// -----------------------------------------------------------------------------
// Fetcher
// -----------------------------------------------------------------------------

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => {
    if (!r.ok) {
      throw new Error(`Failed: ${r.status}`);
    }

    return r.json();
  });

// -----------------------------------------------------------------------------
// Parsing helpers
// -----------------------------------------------------------------------------

function parseJsonArray<T = unknown>(v: unknown): T[] | null {
  if (v == null) return null;

  if (Array.isArray(v)) {
    return v as T[];
  }

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);
      return Array.isArray(parsed) ? (parsed as T[]) : null;
    } catch {
      return null;
    }
  }

  return null;
}

function toNumberArray(v: unknown): number[] | null {
  if (v == null) return null;

  if (typeof v === "number") {
    return [v];
  }

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);

      if (Array.isArray(parsed)) {
        const arr = parsed
          .map(Number)
          .filter(Number.isFinite);

        return arr.length ? arr : null;
      }
    } catch {
      // Continue below.
    }

    const n = Number(v);

    return Number.isFinite(n) ? [n] : null;
  }

  if (Array.isArray(v)) {
    const arr = v
      .map(Number)
      .filter(Number.isFinite);

    return arr.length ? arr : null;
  }

  return null;
}

function toStringArray(v: unknown): string[] | null {
  if (v == null) return null;

  if (Array.isArray(v)) {
    return v.map(String);
  }

  if (typeof v === "string") {
    try {
      const parsed = JSON.parse(v);

      return Array.isArray(parsed)
        ? parsed.map(String)
        : [v];
    } catch {
      return [v];
    }
  }

  return null;
}

function normalizeClobTokenIds(v: unknown): string[] {
  if (
    Array.isArray(v) &&
    v.every(
      (x) =>
        typeof x === "string" &&
        !x.includes("[")
    )
  ) {
    return v as string[];
  }

  const jsonArr = parseJsonArray<string>(v);

  if (jsonArr) {
    return jsonArr;
  }

  if (
    Array.isArray(v) &&
    v.length === 2 &&
    typeof v[0] === "string" &&
    typeof v[1] === "string"
  ) {
    const joined = String(v[0]) + String(v[1]);

    const candidates = [
      joined,
      joined.replace(/"\s*"/g, '","'),
      joined.replace(/\\{2,}/g, "\\"),
    ];

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);

        if (Array.isArray(parsed)) {
          return parsed.map(String);
        }
      } catch {
        // Try next.
      }
    }
  }

  return [];
}

// -----------------------------------------------------------------------------
// Formatting
// -----------------------------------------------------------------------------

function formatCompactNumber(
  value: number | string | null | undefined
) {
  if (value == null) return "—";

  const n = Number(value);

  if (!Number.isFinite(n)) return "—";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function formatProbability(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

// -----------------------------------------------------------------------------
// Market interpretation
//
// This intentionally uses conservative language.
// We only classify markets when the question contains recognizable
// directional language.
// -----------------------------------------------------------------------------

function inferMarketDirection(
  question: string
): Direction {
  const q = question.toLowerCase();

  // Clearly bearish outcome language.
  const bearishPatterns = [
    "fall below",
    "falls below",
    "drop below",
    "drops below",
    "decline below",
    "declines below",
    "below $",
    "under $",
    "less than $",
    "lower than $",
    "decrease",
    "decline",
    "crash",
    "collapse",
    "bear",
    "bearish",
  ];

  // Clearly bullish outcome language.
  const bullishPatterns = [
    "reach",
    "reaches",
    "above $",
    "over $",
    "exceed",
    "exceeds",
    "higher than $",
    "greater than $",
    "increase",
    "rise",
    "rises",
    "surpass",
    "surpasses",
    "bull",
    "bullish",
  ];

  if (bearishPatterns.some((pattern) => q.includes(pattern))) {
    return "bearish";
  }

  if (bullishPatterns.some((pattern) => q.includes(pattern))) {
    return "bullish";
  }

  return "neutral";
}

// -----------------------------------------------------------------------------
// Market weighting
//
// Volume = 60%
// Liquidity = 40%
//
// log1p prevents one giant market from completely dominating the analysis.
// -----------------------------------------------------------------------------

function calculateMarketWeight(market: Market): number {
  const volume = Math.max(
    0,
    Number(market.volume24hr) || 0
  );

  const liquidity = Math.max(
    0,
    Number(market.liquidity) || 0
  );

  const volumeWeight = Math.log1p(volume);
  const liquidityWeight = Math.log1p(liquidity);

  return (
    volumeWeight * 0.6 +
    liquidityWeight * 0.4
  );
}

// -----------------------------------------------------------------------------
// Analysis engine
// -----------------------------------------------------------------------------

function analyzeMarkets(
  markets: Market[]
): MarketAnalysis {
  const analyzed: AnalyzedMarket[] = [];

  for (const market of markets) {
    const prices = toNumberArray(
      market.gammaOutcomePrices
    );

    const probability =
      prices?.[0] != null
        ? Math.min(Math.max(prices[0], 0), 1)
        : null;

    const direction = inferMarketDirection(
      market.question
    );

    const weight = calculateMarketWeight(market);

    if (probability == null || weight <= 0) {
      continue;
    }

    /*
     * Convert each market into a bullishness score:
     *
     * Bullish market:
     *   75% Yes -> +0.75
     *
     * Bearish market:
     *   75% Yes -> -0.75
     *
     * This means the final score always runs from:
     *
     * -1 = strongly bearish
     *  0 = neutral
     * +1 = strongly bullish
     */

    let signal = 0;

    if (direction === "bullish") {
      signal = probability;
    } else if (direction === "bearish") {
      signal = -probability;
    }

    analyzed.push({
      ...market,
      probability,
      weight,
      direction,
      signal,
    });
  }

  if (analyzed.length === 0) {
    return {
      sentiment: "neutral",
      score: 0,
      confidence: 0,
      bullishMarkets: 0,
      bearishMarkets: 0,
      neutralMarkets: 0,
      totalMarkets: 0,
      weightedMarkets: [],
      strongestSignal: null,
      mostActive: null,
      highestLiquidity: null,
      insight:
        "There is not enough directional market data to establish a meaningful consensus.",
    };
  }

  const totalWeight = analyzed.reduce(
    (sum, market) => sum + market.weight,
    0
  );

  const weightedScore =
    analyzed.reduce(
      (sum, market) =>
        sum + market.signal * market.weight,
      0
    ) / totalWeight;

  // ---------------------------------------------------------------------------
  // Sentiment
  // ---------------------------------------------------------------------------

  let sentiment: Direction = "neutral";

  if (weightedScore >= 0.15) {
    sentiment = "bullish";
  } else if (weightedScore <= -0.15) {
    sentiment = "bearish";
  }

  // ---------------------------------------------------------------------------
  // Market agreement
  // ---------------------------------------------------------------------------

  const directionalMarkets = analyzed.filter(
    (market) => market.direction !== "neutral"
  );

  const bullishMarkets = directionalMarkets.filter(
    (market) => market.signal > 0
  ).length;

  const bearishMarkets = directionalMarkets.filter(
    (market) => market.signal < 0
  ).length;

  const neutralMarkets = analyzed.filter(
    (market) => market.direction === "neutral"
  ).length;

  /*
   * Agreement is more useful than simply counting markets.
   *
   * If 8/10 markets are bullish, agreement is high.
   * If 5/10 are bullish and 5/10 bearish, agreement is low.
   */

  const directionalCount = directionalMarkets.length;

  let agreement = 0;

  if (directionalCount > 0) {
    agreement =
      Math.max(
        bullishMarkets,
        bearishMarkets
      ) / directionalCount;
  }

  /*
   * Score strength:
   *
   * 0.0 = no directional conviction
   * 1.0 = extremely directional
   */

  const scoreStrength = Math.min(
    Math.abs(weightedScore),
    1
  );

  /*
   * Conviction combines:
   *
   * 60% agreement
   * 40% score strength
   */

  const confidence =
    (agreement * 0.6 +
      scoreStrength * 0.4) *
    100;

  // ---------------------------------------------------------------------------
  // Most influential market
  //
  // Influence = market weight × distance from neutral
  // ---------------------------------------------------------------------------

  const strongestSignal =
    [...directionalMarkets]
      .sort(
        (a, b) =>
          Math.abs(b.signal) * b.weight -
          Math.abs(a.signal) * a.weight
      )[0] ?? null;

  // ---------------------------------------------------------------------------
  // Most active
  // ---------------------------------------------------------------------------

  const mostActive =
    [...analyzed].sort(
      (a, b) =>
        (Number(b.volume24hr) || 0) -
        (Number(a.volume24hr) || 0)
    )[0] ?? null;

  // ---------------------------------------------------------------------------
  // Highest liquidity
  // ---------------------------------------------------------------------------

  const highestLiquidity =
    [...analyzed].sort(
      (a, b) =>
        (Number(b.liquidity) || 0) -
        (Number(a.liquidity) || 0)
    )[0] ?? null;

  // ---------------------------------------------------------------------------
  // Human-readable insight
  // ---------------------------------------------------------------------------

  const sentimentLabel =
    sentiment === "bullish"
      ? "bullish"
      : sentiment === "bearish"
        ? "bearish"
        : "mixed";

  const convictionLabel =
    confidence >= 75
      ? "high"
      : confidence >= 50
        ? "medium"
        : "low";

  const weightedProbability =
    Math.abs(weightedScore);

  let insight = "";

  if (directionalMarkets.length === 0) {
    insight =
      "Current markets do not contain enough recognizable directional price signals to establish a meaningful consensus.";
  } else if (sentiment === "bullish") {
    insight = `Polymarket is ${sentimentLabel}, with ${bullishMarkets} of ${directionalCount} directional markets favoring upside. Consensus is ${convictionLabel} conviction, based on market participation and liquidity.`;
  } else if (sentiment === "bearish") {
    insight = `Polymarket is ${sentimentLabel}, with ${bearishMarkets} of ${directionalCount} directional markets favoring downside. Consensus is ${convictionLabel} conviction, based on market participation and liquidity.`;
  } else {
    insight = `Polymarket signals are mixed. Directional markets are relatively balanced, suggesting low conviction despite active trading.`;
  }

  return {
    sentiment,
    score: weightedScore,
    confidence,
    bullishMarkets,
    bearishMarkets,
    neutralMarkets,
    totalMarkets: analyzed.length,
    weightedMarkets: analyzed,
    strongestSignal,
    mostActive,
    highestLiquidity,
    insight,
  };
}

// -----------------------------------------------------------------------------
// Consensus Summary
// -----------------------------------------------------------------------------

function ConsensusSummary({
  analysis,
  asset,
}: {
  analysis: MarketAnalysis;
  asset: string;
}) {
  const assetName =
    asset.charAt(0).toUpperCase() +
    asset.slice(1);

  const scorePercent =
    50 + analysis.score * 50;

  const sentimentColor =
    analysis.sentiment === "bullish"
      ? "text-emerald-600 dark:text-emerald-400"
      : analysis.sentiment === "bearish"
        ? "text-rose-600 dark:text-rose-400"
        : "text-amber-600 dark:text-amber-400";

  const barColor =
    analysis.sentiment === "bullish"
      ? "bg-emerald-500"
      : analysis.sentiment === "bearish"
        ? "bg-rose-500"
        : "bg-amber-500";

  const sentimentLabel =
    analysis.sentiment === "bullish"
      ? "Bullish"
      : analysis.sentiment === "bearish"
        ? "Bearish"
        : "Mixed";

  const conviction =
    analysis.confidence >= 75
      ? "High"
      : analysis.confidence >= 50
        ? "Medium"
        : "Low";

  return (
    <div className="rounded-2xl border bg-gradient-to-br from-background to-black/[0.025] p-5 dark:to-white/[0.025]">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Polymarket Consensus
            </span>

            <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] font-medium dark:bg-white/10">
              {analysis.totalMarkets} markets
            </span>
          </div>

          <h3 className="mt-1 text-xl font-semibold tracking-tight">
            {assetName} market outlook
          </h3>
        </div>

        <div
          className={`text-sm font-semibold ${sentimentColor}`}
        >
          {sentimentLabel}
        </div>
      </div>

      {/* Main score */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_auto]">
        <div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs text-muted-foreground">
                Weighted market sentiment
              </div>

              <div
                className={`mt-1 text-4xl font-bold tracking-tight ${sentimentColor}`}
              >
                {Math.round(scorePercent)}%
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                Conviction
              </div>

              <div className="mt-1 text-sm font-semibold">
                {conviction}
              </div>
            </div>
          </div>

          {/* Sentiment bar */}
          <div className="relative mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{
                  width: `${scorePercent}%`,
                }}
              />
            </div>

            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>Bearish</span>
              <span>Neutral</span>
              <span>Bullish</span>
            </div>
          </div>
        </div>

        {/* Market agreement */}
        <div className="min-w-[180px] rounded-xl border bg-background p-4">
          <div className="text-xs text-muted-foreground">
            Market agreement
          </div>

          <div className="mt-1 text-2xl font-bold">
            {analysis.sentiment === "bullish"
              ? `${analysis.bullishMarkets}/${analysis.totalMarkets}`
              : analysis.sentiment === "bearish"
                ? `${analysis.bearishMarkets}/${analysis.totalMarkets}`
                : `${Math.max(
                    analysis.bullishMarkets,
                    analysis.bearishMarkets
                  )}/${analysis.totalMarkets}`}
          </div>

          <div className="mt-1 text-xs text-muted-foreground">
            markets supporting the dominant direction
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="mt-5 rounded-xl bg-black/[0.035] p-4 dark:bg-white/[0.035]">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Market insight
        </div>

        <p className="mt-1.5 text-sm leading-relaxed">
          {analysis.insight}
        </p>
      </div>

      {/* Key signals */}
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {/* Strongest signal */}
        {analysis.strongestSignal && (
          <div className="rounded-xl border p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Strongest signal
            </div>

            <div className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed">
              {analysis.strongestSignal.question}
            </div>

            <div
              className={`mt-2 text-lg font-bold ${
                analysis.strongestSignal.direction ===
                "bullish"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-rose-600 dark:text-rose-400"
              }`}
            >
              {formatProbability(
                analysis.strongestSignal.probability ?? 0
              )}
            </div>
          </div>
        )}

        {/* Most active */}
        {analysis.mostActive && (
          <div className="rounded-xl border p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Most active
            </div>

            <div className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed">
              {analysis.mostActive.question}
            </div>

            <div className="mt-2 text-lg font-bold">
              $
              {formatCompactNumber(
                analysis.mostActive.volume24hr
              )}
            </div>

            <div className="text-[10px] text-muted-foreground">
              24h volume
            </div>
          </div>
        )}

        {/* Highest liquidity */}
        {analysis.highestLiquidity && (
          <div className="rounded-xl border p-3">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Deepest market
            </div>

            <div className="mt-2 line-clamp-2 text-xs font-medium leading-relaxed">
              {analysis.highestLiquidity.question}
            </div>

            <div className="mt-2 text-lg font-bold">
              $
              {formatCompactNumber(
                analysis.highestLiquidity.liquidity
              )}
            </div>

            <div className="text-[10px] text-muted-foreground">
              liquidity
            </div>
          </div>
        )}
      </div>

      {/* Methodology */}
      <div className="mt-4 text-[10px] leading-relaxed text-muted-foreground">
        Consensus is weighted 60% by 24h trading volume and
        40% by liquidity. Logarithmic weighting prevents a
        single unusually large market from dominating the
        signal.
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Main Component
// -----------------------------------------------------------------------------

export default function Polymarket({
  limit = 8,
  includeClosed = false,
  livePrices = true,
  className = "",
  asset = "bitcoin",
}: {
  limit?: number;
  includeClosed?: boolean;
  livePrices?: boolean;
  className?: string;
  asset?: string;
}) {
  const [sortBy, setSortBy] = useState<
    "volume" | "liquidity"
  >("volume");

  const [sortDir, setSortDir] = useState<
    "high" | "low"
  >("high");

  const qs = new URLSearchParams();

  qs.set("limit", String(limit));

  if (includeClosed) {
    qs.set("includeClosed", "1");
  }

  if (livePrices) {
    qs.set("livePrices", "1");
  }

  const { data, error, isLoading, mutate } =
    useSWR<ApiResponse>(
      `/api/polymarket/${asset}?${qs.toString()}`,
      fetcher,
      {
        refreshInterval: livePrices ? 15000 : 60000,
      }
    );

  const markets = data?.data ?? [];

  const analysis = useMemo(
    () => analyzeMarkets(markets),
    [markets]
  );

  const sortedMarkets = useMemo(() => {
    return [...markets]
      .sort((a, b) => {
        const aValue =
          sortBy === "volume"
            ? Number(a.volume24hr) || 0
            : Number(a.liquidity) || 0;

        const bValue =
          sortBy === "volume"
            ? Number(b.volume24hr) || 0
            : Number(b.liquidity) || 0;

        return sortDir === "high"
          ? bValue - aValue
          : aValue - bValue;
      })
      .slice(0, limit);
  }, [
    markets,
    sortBy,
    sortDir,
    limit,
  ]);

  if (isLoading) {
    return (
      <div
        className={`rounded-2xl border p-5 ${className}`}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-48 rounded bg-black/10 dark:bg-white/10" />

          <div className="h-52 rounded-xl bg-black/5 dark:bg-white/5" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`rounded-2xl border p-5 ${className}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">
              Polymarket unavailable
            </div>

            <div className="mt-1 text-sm text-muted-foreground">
              Unable to load market data.
            </div>
          </div>

          <button
            onClick={() => mutate()}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const assetName =
    asset.charAt(0).toUpperCase() +
    asset.slice(1);

  return (
    <section className={`space-y-5 ${className}`}>
      {/* ================================================================
          CONSENSUS SUMMARY
          ================================================================ */}

      <ConsensusSummary
        analysis={analysis}
        asset={asset}
      />

      {/* ================================================================
          MARKET LIST
          ================================================================ */}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold">
            Active markets
          </h3>

          <p className="text-xs text-muted-foreground">
            {assetName} prediction markets ranked by{" "}
            {sortBy}.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border p-0.5">
            <button
              onClick={() => setSortBy("volume")}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                sortBy === "volume"
                  ? "bg-black/5 dark:bg-white/10"
                  : "text-muted-foreground"
              }`}
            >
              Volume
            </button>

            <button
              onClick={() => setSortBy("liquidity")}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium ${
                sortBy === "liquidity"
                  ? "bg-black/5 dark:bg-white/10"
                  : "text-muted-foreground"
              }`}
            >
              Liquidity
            </button>
          </div>

          <button
            onClick={() =>
              setSortDir((current) =>
                current === "high"
                  ? "low"
                  : "high"
              )
            }
            className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
          >
            {sortDir === "high"
              ? "↓ High"
              : "↑ Low"}
          </button>

          <button
            onClick={() => mutate()}
            className="rounded-lg border px-2.5 py-1.5 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </div>

      {sortedMarkets.length === 0 ? (
        <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
          No markets found.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {sortedMarkets.map((market, index) => {
            const outcomes =
              toStringArray(market.outcomes) ??
              ["Yes", "No"];

            const prices = toNumberArray(
              market.gammaOutcomePrices
            );

            const yes = prices?.[0] ?? null;
            const no = prices?.[1] ?? null;

            const yesPct =
              yes != null ? yes * 100 : null;

            const noPct =
              no != null ? no * 100 : null;

            const yesIsLeading =
              yesPct != null &&
              noPct != null &&
              yesPct >= noPct;

            const clobs = normalizeClobTokenIds(
              market.clobTokenIds
            );

            const yesToken = clobs[0];

            const live =
              yesToken &&
              market.livePrices?.[yesToken]
                ? market.livePrices[yesToken]
                : null;

            return (
              <Link
                key={market.marketSlug}
                href={market.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <article className="h-full rounded-2xl border bg-background p-4 transition-all hover:-translate-y-0.5 hover:border-black/20 hover:shadow-md dark:hover:border-white/20">
                  <div className="flex gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-black/5 text-[11px] font-semibold text-muted-foreground dark:bg-white/10">
                      {index + 1}
                    </div>

                    <h4 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:underline">
                      {market.question}
                    </h4>
                  </div>

                  {/* Probability */}
                  <div className="mt-5">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {outcomes[0] ?? "Yes"}
                        </div>

                        <div
                          className={`text-2xl font-bold ${
                            yesIsLeading
                              ? "text-emerald-600 dark:text-emerald-400"
                              : ""
                          }`}
                        >
                          {yes != null
                            ? formatProbability(yes)
                            : "—"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                          {outcomes[1] ?? "No"}
                        </div>

                        <div
                          className={`text-lg font-semibold ${
                            !yesIsLeading &&
                            no != null
                              ? "text-rose-600 dark:text-rose-400"
                              : "text-muted-foreground"
                          }`}
                        >
                          {no != null
                            ? formatProbability(no)
                            : "—"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-rose-500/20">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{
                          width: `${Math.min(
                            Math.max(
                              yesPct ?? 0,
                              0
                            ),
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Live prices */}
                  {live && (
                    <div className="mt-4 flex gap-2">
                      <div className="rounded-md bg-emerald-500/10 px-2 py-1 text-xs">
                        <span className="mr-1 text-[10px] uppercase text-emerald-700/70 dark:text-emerald-400/70">
                          Buy
                        </span>

                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {live.buy ?? "—"}
                        </span>
                      </div>

                      <div className="rounded-md bg-rose-500/10 px-2 py-1 text-xs">
                        <span className="mr-1 text-[10px] uppercase text-rose-700/70 dark:text-rose-400/70">
                          Sell
                        </span>

                        <span className="font-semibold text-rose-700 dark:text-rose-400">
                          {live.sell ?? "—"}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
                    <span>
                      24h Vol{" "}
                      <strong className="font-medium text-foreground">
                        $
                        {formatCompactNumber(
                          market.volume24hr
                        )}
                      </strong>
                    </span>

                    <span>
                      Liquidity{" "}
                      <strong className="font-medium text-foreground">
                        $
                        {formatCompactNumber(
                          market.liquidity
                        )}
                      </strong>
                    </span>
                  </div>
                </article>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}