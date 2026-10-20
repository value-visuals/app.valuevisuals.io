"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import ThemeToggle from "@/components/theme/ThemeToggle";
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const router = useRouter();
  const search = useSearchParams();

  const expired = search.get("expired") === "1";

  async function handleForgotPassword() {
    const normalizedEmail = email.trim();

    setError(null);
    setResetMessage(null);

    if (!normalizedEmail) {
      setError(
        "Enter your email address first, then select Forgot password."
      );
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(
        auth,
        normalizedEmail
      );

      setResetMessage(
        "If an account exists for that email address, password reset instructions have been sent."
      );
    } catch (err: unknown) {
      console.error(
        "[AUTH] Password reset error:",
        err
      );

      const code =
        (err as { code?: string })?.code || "";

      if (code === "auth/invalid-email") {
        setError(
          "Please enter a valid email address."
        );
      } else {
        /*
         * Keep the response generic so the UI does not reveal
         * whether an email address is registered.
         */
        setResetMessage(
          "If an account exists for that email address, password reset instructions have been sent."
        );
      }
    } finally {
      setResetLoading(false);
    }
  }

  async function onSubmit(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError(null);
    setResetMessage(null);
    setLoading(true);

    try {
      const credential =
        await signInWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      const idToken =
        await credential.user.getIdToken(true);

      const sessionResponse =
        await fetch("/api/auth/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          cache: "no-store",
          body: JSON.stringify({
            idToken,
          }),
        });

      const sessionData =
        await sessionResponse
          .json()
          .catch(() => ({}));

      if (!sessionResponse.ok) {

        await firebaseSignOut(auth);

        throw new Error(
          sessionData?.error ||
            "Unable to establish server session"
        );
      }

      console.log(
        "[AUTH] Sign-in successful"
      );

      router.replace("/dashboard");
    } catch (err: unknown) {
      console.error(
        "[AUTH] Sign-in error:",
        err
      );

      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to sign in");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
      <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-8 shadow-sm ring-1 ring-[var(--border)]">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">
            Welcome back
          </h1>

          <p className="mt-2 text-base text-[var(--muted-foreground)]">
            Sign in - value awaits.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Mail className="h-4 w-4 text-[var(--muted-foreground)]" />
            </span>

            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-10 py-2.5 text-sm text-[var(--foreground)] shadow-sm outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[color:var(--ring)]/30"
              placeholder="you@example.com"
            />
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Lock className="h-4 w-4 text-[var(--muted-foreground)]" />
            </span>

            <input
              id="password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-10 py-2.5 text-sm text-[var(--foreground)] shadow-sm outline-none placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-4 focus:ring-[color:var(--ring)]/30"
              placeholder="••••••••"
            />

            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-3 inline-flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {showPw ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>

          {error && (
            <p
              className="rounded-lg border px-3 py-2 text-sm font-medium"
              style={{
                backgroundColor: "var(--auth-error-bg)",
                color: "var(--auth-error-foreground)",
                borderColor: "var(--auth-error-border)",
              }}
            >
              {error}
            </p>
          )}

          {resetMessage && !error && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800 ring-1 ring-green-200 dark:bg-green-900/30 dark:text-green-200 dark:ring-green-900">
              {resetMessage}
            </p>
          )}

          {expired && !error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200 dark:bg-red-900/30 dark:text-red-200 dark:ring-red-900">
              Your session expired. Please sign in again.
            </p>
          )}

          <Button
            type="submit"
            disabled={loading || resetLoading}
            className="w-full rounded-xl py-2.5 text-sm border border-transparent dark:border-white overflow-visible"
          >
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          Don’t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium underline hover:no-underline text-[var(--primary)]"
          >
            Create one
          </Link>
        </p>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          Forgot Password?{" "}
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={resetLoading || loading}
            className="text-sm font-medium text-[var(--primary)] underline hover:no-underline disabled:cursor-not-allowed disabled:opacity-50"
          >
            {resetLoading
              ? "Sending reset email…"
              : "Reset"}
          </button>
        </p>

        <div className="mt-4 flex justify-center">
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}