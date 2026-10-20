// src/components/LogoutButton.tsx
"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";

type Props = {
  className?: string;
  label?: string;
};

export default function LogoutButton({
  className = "",
  label = "Log out",
}: Props) {
  const { logout } = useAuth();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    if (loading) return;

    setLoading(true);

    try {
      /*
       * Use the centralized authentication logout flow.
       *
       * AuthProvider handles:
       * - backend refresh-token revocation
       * - Next.js session-cookie cleanup
       * - Firebase client sign-out
       * - redirect to /signin
       */
      await logout(false);
    } catch (err) {
      /*
       * AuthProvider is designed to redirect in its finally block,
       * so this is primarily a last-resort diagnostic.
       */
      console.error("Logout failed:", err);
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
      <span className="hidden sm:inline">
        {loading ? "Logging out..." : label}
      </span>
    </button>
  );
}
