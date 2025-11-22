// src/components/LogoutButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { getAuth, signOut } from "firebase/auth";
import { LogOut } from "lucide-react";
import { useState } from "react";

type Props = {
  className?: string;
  label?: string;
};

export default function LogoutButton({ className = "", label = "Log out" }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;
    setLoading(true);

    try {
      // 1) Clear HttpOnly cookies on the server (__session, refreshToken)
      await fetch("/api/auth/signout", { method: "POST", cache: "no-store" }).catch(() => {});

      // 2) Clear any client-stored tokens (just in case)
      try {
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("idToken");
        sessionStorage.removeItem("refreshToken");
        sessionStorage.removeItem("idToken");
      } catch {
        /* ignore */
      }

      // 3) Sign out Firebase client session
      try {
        await signOut(getAuth());
      } catch {
        /* ignore if Firebase isn't initialized on this page */
      }

      // 4) Redirect and refresh
      router.replace("/signin");
      router.refresh();
    } catch (err) {
      console.error("Logout failed:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className={`inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm bg-transparent hover:bg-[var(--surface-dark)] text-foreground disabled:opacity-50 ${className}`}
      aria-label="Log out"
      aria-busy={loading}
      disabled={loading}
      title="Log out"
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">{loading ? "Logging out..." : label}</span>
    </button>
  );
}
