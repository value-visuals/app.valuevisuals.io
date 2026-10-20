/**
 * Web: always request the current Next.js origin, so local development routes
 * through localhost:3015 and avoids cross-origin bearer-token requests.
 * Capacitor static export: use the hosted Next.js proxy origin over HTTPS.
 */
export function clientApiUrl(path: string): string {
  if (!path.startsWith("/api/")) return path;
  if (process.env.NEXT_PUBLIC_MOBILE_STATIC_EXPORT !== "true") return path;
  const origin = process.env.NEXT_PUBLIC_API_PROXY_ORIGIN;
  if (!origin || !/^https:\/\/[a-z0-9.-]+(?::443)?$/i.test(origin)) {
    throw new Error("Mobile static builds require an HTTPS NEXT_PUBLIC_API_PROXY_ORIGIN");
  }
  return `${origin}${path}`;
}
