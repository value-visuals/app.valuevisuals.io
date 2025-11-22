// app/signup/page.tsx
"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, User } from "lucide-react";
import ThemeToggle from "@/components/theme/ThemeToggle";
import { getAuth, signInWithCustomToken } from "firebase/auth";

type InterestKey = "bitcoin" | "ethereum" | "gold" | "silver";

const ALL_INTERESTS: { key: InterestKey; label: string; icon: React.ReactNode }[] = [
  {
    key: "bitcoin",
    label: "Bitcoin",
    icon: (
      <Image
        src="/bitcoin.svg"
        alt="Bitcoin"
        width={20}
        height={20}
        className="h-5 w-5"
        priority
      />
    ),
  },
  {
    key: "ethereum",
    label: "Ethereum",
    icon: (
      <Image
        src="/ethereum.png"
        alt="Ethereum"
        width={20}
        height={20}
        className="h-5 w-5"
        priority
      />
    ),
  },
  { key: "gold", label: "Gold", icon: <span className="text-lg leading-none">🥇</span> },
  { key: "silver", label: "Silver", icon: <span className="text-lg leading-none">🥈</span> },
];

export default function SignUpPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [showPw,    setShowPw]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [interests, setInterests] = useState<InterestKey[]>([]);
  const router = useRouter();

  function toggleInterest(key: InterestKey) {
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);

    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`.trim();

      // 1) Create the account via our API and receive a customToken
      const signupRes = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          displayName,
          interests, // <-- pass selected interests to backend
        }),
      });

      const signupJson = await signupRes.json().catch(() => ({} as any));
      if (!signupRes.ok || !signupJson?.customToken) {
        throw new Error(
          signupJson?.error || "Failed to create account (no customToken)"
        );
      }

      // 2) Client-side exchange of customToken -> idToken using Firebase SDK
      const auth = getAuth();
      const cred = await signInWithCustomToken(auth, signupJson.customToken);
      const idToken = await cred.user.getIdToken(true);
      const refreshToken = cred.user.refreshToken;

      // 3) Persist session as httpOnly cookies on the server
      const sessionRes = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken, refreshToken, expiresIn: 3600 }),
      });

      if (!sessionRes.ok) {
        const j = await sessionRes.json().catch(() => ({} as any));
        throw new Error(j?.error || "Failed to persist session");
      }

      router.replace("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to sign up");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] " +
    "px-10 py-2.5 text-sm text-[var(--foreground)] shadow-sm outline-none " +
    "placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] " +
    "focus:ring-4 focus:ring-[color:var(--ring)]/30";

  const iconClass = "h-4 w-4 text-[var(--muted-foreground)]";

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-[var(--background)] text-[var(--foreground)]">
      <div className="w-full max-w-md rounded-2xl bg-[var(--card)] p-8 shadow-sm ring-1 ring-[var(--border)]">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-[var(--foreground)]">Create your account</h1>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* First Name */}
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <User className={iconClass} />
            </span>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className={inputClass}
              placeholder="First name"
              autoComplete="given-name"
            />
          </div>

          {/* Last Name */}
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <User className={iconClass} />
            </span>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className={inputClass}
              placeholder="Last name"
              autoComplete="family-name"
            />
          </div>

          {/* Email */}
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Mail className={iconClass} />
            </span>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={inputClass}
              placeholder="you@example.com"
              autoComplete="email"
              inputMode="email"
            />
          </div>

          {/* Password */}
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
              <Lock className={iconClass} />
            </span>
            <input
              id="password"
              type={showPw ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className={inputClass}
              placeholder="At least 6 characters"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              aria-label={showPw ? "Hide password" : "Show password"}
              className="absolute inset-y-0 right-3 inline-flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {/* Interests */}
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-[var(--foreground)]">
              Interests
            </legend>
            <div className="grid grid-cols-2 gap-3">
              {ALL_INTERESTS.map(({ key, label, icon }) => {
                const selected = interests.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleInterest(key)}
                    className={[
                      "flex items-center gap-2 rounded-xl border px-3 py-2 text-left",
                      "transition-shadow",
                      selected
                        ? "border-[var(--primary)] ring-2 ring-[color:var(--ring)]/40"
                        : "border-[var(--border)] hover:shadow-sm",
                      "bg-[var(--background)]",
                    ].join(" ")}
                    aria-pressed={selected}
                  >
                    <span className="inline-flex h-5 w-5 items-center justify-center">{icon}</span>
                    <span className="text-sm">{label}</span>
                    {selected && (
                      <span className="ml-auto text-xs text-[var(--primary)]"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {/* Error */}
          {error && (
            <p
              className="rounded-lg px-3 py-2 text-sm ring-1"
              style={{
                background: "color-mix(in srgb, var(--destructive) 10%, transparent)",
                color: "var(--destructive-foreground)",
                borderColor: "color-mix(in srgb, var(--destructive) 35%, var(--border))",
              }}
              role="alert"
            >
              {error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full rounded-xl py-2.5 text-sm border border-transparent dark:border-white overflow-visible"
            disabled={loading || !firstName || !lastName || !email || !password}
          >
            {loading ? "Creating account…" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--muted-foreground)]">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium underline hover:no-underline text-[var(--primary)]">
            Sign in
          </Link>
        </p>

        <div className="mt-4 flex justify-center">
          <ThemeToggle />
        </div>
      </div>
    </main>
  );
}
