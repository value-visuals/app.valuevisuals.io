// ── src/lib/utils.ts ─────────────────────────────────────────
export function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}

export const objectToQueryString = (obj: Record<string, unknown>): string => {
  return new URLSearchParams(
    Object.entries(obj)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)]),
  ).toString();
};
