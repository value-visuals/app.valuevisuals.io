import { headers } from "next/headers";

export const makeBaseAndHeaders = async () => {
  const h = await headers();
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");
  const host =
    h.get("x-forwarded-host") ??
    h.get("host") ??
    process.env.VERCEL_URL ??
    "localhost:3000";
  const base = host.startsWith("http") ? host : `${proto}://${host}`;

  const forwardHeaders: Record<string, string> = { accept: "application/json" };
  const cookie = h.get("cookie");
  const authorization = h.get("authorization");
  if (cookie) forwardHeaders.cookie = cookie;
  if (authorization) forwardHeaders.authorization = authorization;

  return { base, forwardHeaders };
};

export const fetchJSON = async <T>(
  path: string,
  options: RequestInit,
  defaultResponse: T,
) => {
  const { base, forwardHeaders } = await makeBaseAndHeaders();

  const next =
    options.next || (options.cache ? undefined : { revalidate: 300 });

  const res = await fetch(`${base}${path}`, {
    ...options,
    next,
    headers: forwardHeaders,
  });
  let data: T | undefined;
  try {
    data = (await res.json()) as T;
  } catch {
    return defaultResponse;
  }

  return { ok: res.ok, status: res.status, data };
};
