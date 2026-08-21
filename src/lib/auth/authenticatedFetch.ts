// src/lib/auth/authenticatedFetch.ts

import { auth } from "@/lib/firebase";

export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;

  if (!user) {
    throw new Error("AUTH_REQUIRED");
  }

  /*
   * Firebase automatically refreshes the token when necessary.
   */
  const idToken = await user.getIdToken();

  const headers = new Headers(options.headers);

  headers.set(
    "Authorization",
    `Bearer ${idToken}`
  );

  /*
   * Only set Content-Type automatically when appropriate.
   */
  if (
    options.body &&
    !headers.has("Content-Type")
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
    cache: "no-store",
  });

  /*
   * Let the caller handle the actual response.
   *
   * In a later step we can centralize 401 handling here
   * and automatically call logout().
   */
  return response;
}