import { getApiUrl } from "@/lib/getApiUrl";

/** Public, server-to-server market requests. Never forward browser credentials. */
export async function fetchPublicMarketApi<T>(path: string, timeoutMs = 8_000): Promise<T> {
  if (!path.startsWith("/api/market/") && !path.startsWith("/api/crypto/chart") && !path.startsWith("/api/metals/chart")) {
    throw new Error("Invalid public market endpoint");
  }
  const response = await fetch(`${getApiUrl()}${path}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    next: { revalidate: 30 },
  });
  if (!response.ok) throw new Error(`Public market API returned ${response.status}`);
  return response.json() as Promise<T>;
}
