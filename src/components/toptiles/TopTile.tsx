"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

type TopTileProps = {
  label: string;
  value: string;
  change?: number | null;
  error?: boolean;
};

export default function TopTile({
  label,
  value,
  change,
  error = false,
}: TopTileProps) {
  const hasChange = change != null;
  const positive =
    change != null && change >= 0;

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm transition-colors min-w-0">
      <div className="text-sm text-muted-foreground">
        {label}
      </div>

      <div className="mt-1 truncate text-2xl font-semibold text-[var(--foreground)]">
        {error ? "—" : value}
      </div>

      {hasChange && !error && (
        <div
          className={`mt-1 flex items-center gap-1 text-xs ${
            positive
              ? "text-green-600"
              : "text-red-600"
          }`}
        >
          {positive ? (
            <ArrowUpRight size={16} />
          ) : (
            <ArrowDownRight size={16} />
          )}

          {(change * 100).toFixed(2)}%
        </div>
      )}
    </div>
  );
}