// app/(dashboard)/dashboard/wallets/page.tsx
import { cookies, headers } from "next/headers";
import ClientWallets from "./ClientWallets";

type Chain = "btc" | "eth";
type WalletItem = { id: string; chain: Chain; address: string; createdAt: number };

// NEW
type Metal = "gold" | "silver";
type MetalUnit = "g" | "oz" | "lb";
type MetalWallet = { id: string; name: string; amount: number; unit: MetalUnit; createdAtMs?: number };
type InitialMetals = { gold: MetalWallet[]; silver: MetalWallet[] };

async function fetchWalletsOnServer(): Promise<WalletItem[]> {
  const h = await headers();
  const c = await cookies();

  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const res = await fetch(`${origin}/api/crypto/wallets`, {
    cache: "no-store",
    headers: {
      cookie: c.toString(),
      ...(h.get("authorization") ? { authorization: h.get("authorization")! } : {}),
      accept: "application/json",
    },
  });

  if (!res.ok) throw new Error(await res.text());

  const data = await res.json();
  const btc = Array.isArray((data as any).bitcoin) ? (data as any).bitcoin : [];
  const eth = Array.isArray((data as any).ethereum) ? (data as any).ethereum : [];

  const normalized: WalletItem[] = [
    ...btc.map((w: any) => ({
      id: `btc-${w.createdAtMs ?? Date.now()}-${w.address}`,
      chain: "btc" as const,
      address: w.address,
      createdAt: Number(w.createdAtMs ?? Date.now()),
    })),
    ...eth.map((w: any) => ({
      id: `eth-${w.createdAtMs ?? Date.now()}-${w.address}`,
      chain: "eth" as const,
      address: w.address,
      createdAt: Number(w.createdAtMs ?? Date.now()),
    })),
  ].sort((a, b) => b.createdAt - a.createdAt);

  return normalized;
}

// NEW: fetch metals server-side with same cookie/auth forwarding
async function fetchMetalsOnServer(): Promise<InitialMetals> {
  const h = await headers();
  const c = await cookies();

  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const origin = `${proto}://${host}`;

  const baseHeaders: HeadersInit = {
    cookie: c.toString(),
    ...(h.get("authorization") ? { authorization: h.get("authorization")! } : {}),
    accept: "application/json",
  };

  const [goldRes, silverRes] = await Promise.all([
    fetch(`${origin}/api/metals/wallets?metal=gold`, { cache: "no-store", headers: baseHeaders }),
    fetch(`${origin}/api/metals/wallets?metal=silver`, { cache: "no-store", headers: baseHeaders }),
  ]);

  if (!goldRes.ok) throw new Error(await goldRes.text());
  if (!silverRes.ok) throw new Error(await silverRes.text());

  const goldJson = await goldRes.json();  // { gold: [...] }
  const silverJson = await silverRes.json(); // { silver: [...] }

  return {
    gold: Array.isArray(goldJson.gold) ? goldJson.gold : [],
    silver: Array.isArray(silverJson.silver) ? silverJson.silver : [],
  };
}

export default async function WalletPage() {
  const [initialWallets, initialMetals] = await Promise.all([
    fetchWalletsOnServer(),
    fetchMetalsOnServer(), // NEW
  ]);

  return <ClientWallets initialWallets={initialWallets} initialMetals={initialMetals} />;
}
