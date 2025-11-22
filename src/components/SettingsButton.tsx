"use client";

import Link from "next/link";
import { Settings } from "lucide-react";

type Props = {
  className?: string;
  label?: string;
};

export default function SettingsButton({ className = "", label = "Settings" }: Props) {
  return (
    <Link
      href="/dashboard/settings"
      aria-label="Settings"
      title="Settings"
      className={`inline-flex items-center gap-2 rounded-xl border border-border bg-transparent px-3 py-2 text-sm hover:bg-[var(--surface-dark)] text-foreground ${className}`}
    >
      <Settings className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}
