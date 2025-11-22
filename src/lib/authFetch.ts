// app/lib/authFetch.ts (or wherever yours lives)
"use client";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

/**
 * A thin fetch wrapper that:
 * - includes cookies by default
 * - on 401: clears server cookies, signs out Firebase, and redirects to /signin
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  // ensure cookies go with same-origin API calls
  const merged: RequestInit = { credentials: "include", ...init };

  const res = await fetch(input, merged);

  if (res.status === 401) {
    // 1) clear httpOnly cookies on the server via your existing route
    try {
      await fetch("/api/auth/signout", { method: "POST", credentials: "include" });
    } catch {
      // ignore network errors here; we still proceed to client sign-out
    }

    // 2) make client auth state null so RequireAuth will redirect
    try {
      await signOut(auth);
    } catch {
      // if already signed out, ignore
    }

    // 3) bounce to signin with an "expired" note
    if (typeof window !== "undefined") {
      window.location.replace("/signin?expired=1");
    }

    // stop caller code from parsing a 401 body
    throw new Error("Session expired");
  }

  return res;
}
