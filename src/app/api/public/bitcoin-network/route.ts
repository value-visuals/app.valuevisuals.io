import { NextResponse } from "next/server";

// Historical estimate, NOT a real-time node uptime monitor.
// Known incidents: 8h27m in 2010 and approximately 6h20m in 2013.
const GENESIS_UTC = Date.UTC(2009, 0, 3, 18, 15, 5);
const HISTORICAL_DOWNTIME_MS = (8 * 60 + 27 + 6 * 60 + 20) * 60_000;

function historicalUptime(now: number): number {
  const elapsed = Math.max(1, now - GENESIS_UTC);
  return Math.max(0, Math.min(100, (1 - HISTORICAL_DOWNTIME_MS / elapsed) * 100));
}

function numeric(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchMempool(path: string): Promise<unknown> {
  const response = await fetch(`https://mempool.space/api/${path}`, {
    headers: { accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error(`Mempool returned ${response.status}`);
  return path.endsWith("height") ? response.text() : response.json();
}

export async function GET() {
  // Partial upstream outages must never break the asset page or converters.
  const [hashResult, heightResult] = await Promise.allSettled([
    fetchMempool("v1/mining/hashrate/3d"),
    fetchMempool("blocks/tip/height"),
  ]);
  const hash = hashResult.status === "fulfilled" && hashResult.value && typeof hashResult.value === "object"
    ? hashResult.value as { currentHashrate?: unknown; currentDifficulty?: unknown }
    : null;

  return NextResponse.json({
    source: "mempool.space",
    hashRateHs: numeric(hash?.currentHashrate),
    difficulty: numeric(hash?.currentDifficulty),
    blockHeight: heightResult.status === "fulfilled" ? numeric(heightResult.value) : null,
    historicalUptimePct: historicalUptime(Date.now()),
  }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300" } });
}
