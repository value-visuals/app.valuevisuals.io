import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { clientApiUrl } from "@/lib/clientApiUrl";

/**
 * Protected calls always use a Firebase ID token, never a password or cookie.
 * Wait for persisted Firebase Auth state before attempting a request: currentUser
 * can be null during the initial browser hydration even for returning users.
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  if (!url.startsWith("/api/") || url.startsWith("//")) {
    throw new Error("Protected requests must use local /api/ routes");
  }
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) throw new Error("AUTH_REQUIRED");

  const request = async (forceRefresh: boolean): Promise<Response> => {
    const token = await user.getIdToken(forceRefresh);
    const headers = new Headers(options.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }
    return fetch(clientApiUrl(url), {
      ...options,
      headers,
      credentials: "omit",
      cache: "no-store",
    });
  };

  const initial = await request(false);
  if (initial.status !== 401) return initial;

  // Retry only an authentication rejection, with a freshly minted ID token.
  // Keep non-auth failures (403/404/429/5xx) visible without logging users out.
  let retry: Response | null = null;
  try {
    retry = await request(true);
  } catch (cause) {
    if (options.signal?.aborted) throw cause;
    // A revoked/expired Firebase refresh token may also fail before HTTP.
  }
  if (retry && retry.status !== 401) return retry;

  if (auth.currentUser?.uid === user.uid) {
    await signOut(auth).catch(() => {});
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("valuevisuals:auth-required"));
    }
  }
  return retry ?? initial;
}
