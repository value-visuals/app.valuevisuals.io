// src/lib/market/chartWindow.ts

/**
 * Shared trading-aware chart-window logic.
 *
 * IMPORTANT:
 * Short financial ranges such as 1D / 2D / 3D represent trading sessions,
 * not literal calendar days.
 *
 * Saturday:
 *   1D -> Friday's trading session
 *   2D -> Thursday + Friday
 *
 * Sunday:
 *   1D -> Friday's trading session
 *   2D -> Thursday + Friday
 *
 * We never manufacture weekend prices.
 */

export type ChartRange =
  | "1d"
  | "2d"
  | "3d"
  | "7d"
  | "14d"
  | "30d"
  | "60d"
  | "90d"
  | "180d"
  | "365d";

export type ChartWindow = {
  range: ChartRange;
  tradingDays: number | null;
  lookbackDays: number;
  start: Date;
  end: Date;
  isTradingSessionRange: boolean;
};

export type ChartPointLike = {
  t: number;
};

/* -------------------------------------------------------------------------- */
/* Range configuration                                                        */
/* -------------------------------------------------------------------------- */

const RANGE_DAYS: Record<ChartRange, number> = {
  "1d": 1,
  "2d": 2,
  "3d": 3,
  "7d": 7,
  "14d": 14,
  "30d": 30,
  "60d": 60,
  "90d": 90,
  "180d": 180,
  "365d": 365,
};

const TRADING_SESSION_RANGES = new Set<ChartRange>(["1d", "2d", "3d"]);

/* -------------------------------------------------------------------------- */
/* Range normalization                                                        */
/* -------------------------------------------------------------------------- */

export function normalizeChartRange(value: string | null | undefined): ChartRange {
  const normalized = String(value ?? "").trim().toLowerCase();

  switch (normalized) {
    case "1d":
    case "2d":
    case "3d":
    case "7d":
    case "14d":
    case "30d":
    case "60d":
    case "90d":
    case "180d":
    case "365d":
      return normalized;
    default:
      return "30d";
  }
}

export function getRangeDays(range: string | null | undefined): number {
  return RANGE_DAYS[normalizeChartRange(range)];
}

export function getTradingDaysForRange(range: string | null | undefined): number | null {
  const normalized = normalizeChartRange(range);
  return TRADING_SESSION_RANGES.has(normalized) ? RANGE_DAYS[normalized] : null;
}

export function isTradingSessionRange(range: string | null | undefined): boolean {
  return getTradingDaysForRange(range) !== null;
}

/* -------------------------------------------------------------------------- */
/* Window resolution                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Resolve the chart's requested window.
 *
 * Short ranges intentionally request 7 calendar days from the provider so
 * weekends and market holidays do not result in empty data.
 *
 * Longer ranges receive a small calendar-day buffer to account for
 * weekends and ordinary market closures.
 */
export function resolveMetalChartWindow(
  rangeInput: string | null | undefined,
  nowInput: Date = new Date()
): ChartWindow {
  const range = normalizeChartRange(rangeInput);
  const tradingDays = getTradingDaysForRange(range);
  const calendarDays = RANGE_DAYS[range];
  const lookbackDays = tradingDays !== null ? 7 : calendarDays + 3;
  const end = new Date(nowInput.getTime());
  const start = new Date(nowInput.getTime());

  start.setDate(start.getDate() - lookbackDays);

  return {
    range,
    tradingDays,
    lookbackDays,
    start,
    end,
    isTradingSessionRange: tradingDays !== null,
  };
}

export function getChartWindow(
  rangeInput: string | null | undefined,
  nowInput: Date = new Date()
): ChartWindow {
  return resolveMetalChartWindow(rangeInput, nowInput);
}

/* -------------------------------------------------------------------------- */
/* Provider range                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Short trading-session ranges always request 7d upstream.
 *
 * This prevents providers from interpreting "1d" as "today", which can
 * produce no data on weekends.
 */
export function getProviderRange(rangeInput: string | null | undefined): string {
  const range = normalizeChartRange(rangeInput);
  return TRADING_SESSION_RANGES.has(range) ? "7d" : range;
}

/* -------------------------------------------------------------------------- */
/* Timestamp helpers                                                          */
/* -------------------------------------------------------------------------- */

export function parseChartTimestamp(
  value: number | string | Date | null | undefined
): number {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : NaN;
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return NaN;
  }

  return Math.abs(value) < 100_000_000_000 ? value * 1000 : value;
}

/* -------------------------------------------------------------------------- */
/* Calendar / trading-session helpers                                        */
/* -------------------------------------------------------------------------- */

export function getLocalDateKey(timestamp: number): string {
  const date = new Date(timestamp);

  if (!Number.isFinite(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function isWeekend(value: Date | number): boolean {
  const date = typeof value === "number" ? new Date(value) : value;
  const day = date.getDay();

  return day === 0 || day === 6;
}

/**
 * Derive trading sessions from actual provider observations.
 *
 * We intentionally do not assume every weekday is a trading day because
 * exchange holidays and market closures vary.
 */
export function getTradingSessionKeys<T extends ChartPointLike>(points: T[]): string[] {
  const sessions = new Set<string>();

  for (const point of points) {
    if (!Number.isFinite(point.t)) continue;

    const key = getLocalDateKey(point.t);
    if (key) sessions.add(key);
  }

  return Array.from(sessions).sort();
}

/* -------------------------------------------------------------------------- */
/* Chart filtering                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Filter actual market points to the requested chart window.
 *
 * Short ranges use the latest actual trading sessions:
 *
 * Saturday:
 *   1D -> latest available session
 *   2D -> latest 2 available sessions
 *
 * Sunday:
 *   1D -> latest available session
 *   2D -> latest 2 available sessions
 *
 * No artificial weekend points are generated.
 */
export function filterChartPointsByWindow<T extends ChartPointLike>(
  points: T[],
  rangeInput: string | null | undefined,
  nowInput: Date = new Date()
): T[] {
  if (!points.length) return [];

  const range = normalizeChartRange(rangeInput);

  const valid = points
    .filter((point) => Number.isFinite(point.t))
    .sort((a, b) => a.t - b.t);

  if (!valid.length) return [];

  const tradingDays = getTradingDaysForRange(range);

  if (tradingDays !== null) {
    const sessionKeys = getTradingSessionKeys(valid);

    if (!sessionKeys.length) return [];

    const selectedKeys = new Set(
      sessionKeys.slice(Math.max(0, sessionKeys.length - tradingDays))
    );

    return valid.filter((point) => selectedKeys.has(getLocalDateKey(point.t)));
  }

  /*
   * Longer ranges remain calendar based.
   */
  const now = nowInput.getTime();
  const start = new Date(now);

  start.setDate(start.getDate() - RANGE_DAYS[range]);

  const startTime = start.getTime();

  return valid.filter((point) => point.t >= startTime && point.t <= now);
}

/* -------------------------------------------------------------------------- */
/* Latest actual market point                                                 */
/* -------------------------------------------------------------------------- */

export function getLatestChartPoint<T extends ChartPointLike>(points: T[]): T | null {
  let latest: T | null = null;

  for (const point of points) {
    if (!Number.isFinite(point.t)) continue;

    if (latest === null || point.t > latest.t) {
      latest = point;
    }
  }

  return latest;
}
