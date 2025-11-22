"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeProvider";

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [mounted, setMounted] = useState(false);
  const { toggle } = useTheme();

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`inline-flex items-center gap-2 rounded-xl border border-border bg-transparent px-3 py-2 text-sm hover:bg-[var(--surface-dark)] text-foreground ${className}`}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
