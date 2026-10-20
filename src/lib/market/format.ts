export function formatMoney(value: number | null | undefined, currency: string, compact = false): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency", currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : Math.abs(value) >= 1000 ? 2 : Math.abs(value) >= 1 ? 2 : 5,
  }).format(value);
}
export function formatChange(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}
