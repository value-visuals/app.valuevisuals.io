// src/app/api/crypto/chart/route.ts
import { NextRequest, NextResponse } from "next/server";
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coin = searchParams.get("coin") || "bitcoin";
  const days = searchParams.get("days") || "30";
  const currency = searchParams.get("currency") || "usd";
  const url = `https://api.coingecko.com/api/v3/coins/${coin}/market_chart?vs_currency=${currency}&days=${days}`;
  try {
    const res = await fetch(url, { next: { revalidate } });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    // log so the variable is used
    console.error("[/api/crypto/chart] fetch failed:", err);
    return NextResponse.json({ prices: [] }, { status: 500 });
  }
}
