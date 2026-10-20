/** Pure chart alignment helpers: compare two USD-denominated crypto series. */
export type PricePoint = { t: number; price: number };
export type ComparisonPoint = { t: number; price: number; basePriceUsd: number; quotePriceUsd: number };

type Candle = { t?: unknown; c?: unknown; close?: unknown };

export function toPricePoints(candles: unknown): PricePoint[] {
  if (!Array.isArray(candles)) return [];
  const points = (candles as Candle[]).map(candle => ({
    t: Number(candle?.t), price: Number(candle?.c ?? candle?.close),
  })).filter(point => Number.isFinite(point.t) && point.t > 0 && Number.isFinite(point.price) && point.price > 0)
    .sort((a, b) => a.t - b.t);
  // Keep newest data for duplicate timestamps.
  return points.filter((point, index) => index === points.length - 1 || point.t !== points[index + 1].t);
}

export function closestPrice(points: PricePoint[], timestamp: number, toleranceMs: number): number | null {
  let lo = 0, hi = points.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (points[mid].t < timestamp) lo = mid + 1;
    else hi = mid;
  }
  const right = points[lo];
  const left = points[lo - 1];
  const best = !left ? right : !right ? left : Math.abs(left.t - timestamp) <= Math.abs(right.t - timestamp) ? left : right;
  return best && Math.abs(best.t - timestamp) <= toleranceMs ? best.price : null;
}

export function compareCandles(baseCandles: unknown, quoteCandles: unknown, days: number): ComparisonPoint[] {
  const base = toPricePoints(baseCandles);
  const quote = toPricePoints(quoteCandles);
  const toleranceMs = days <= 3 ? 30 * 60_000 : days <= 30 ? 3 * 3_600_000 : 12 * 3_600_000;
  return base.flatMap(point => {
    const quotePrice = closestPrice(quote, point.t, toleranceMs);
    if (quotePrice === null) return [];
    const price = point.price / quotePrice;
    if (!Number.isFinite(price) || price <= 0) return [];
    return [{ t: point.t, price, basePriceUsd: point.price, quotePriceUsd: quotePrice }];
  });
}
