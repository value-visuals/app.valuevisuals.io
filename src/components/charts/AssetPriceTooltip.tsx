"use client";

/** A single price readout for both the area and line series in Recharts. */
type PriceEntry = {
  dataKey?: string | number;
  value?: number | string | null;
  payload?: {
    t?: number | string;
    price?: number | string;
  };
};

type AssetPriceTooltipProps = {
  active?: boolean;
  payload?: readonly PriceEntry[];
  label?: number | string;
  currency: string;
  startingPrice: number | null;
};

function money(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: Math.abs(value) < 0.01 ? 6 : 2,
  }).format(value);
}

function signedMoney(value: number, currency: string) {
  return `${value >= 0 ? "+" : "−"}${money(Math.abs(value), currency)}`;
}

export default function AssetPriceTooltip({
  active,
  payload,
  label,
  currency,
  startingPrice,
}: AssetPriceTooltipProps) {
  if (!active || !payload?.length) return null;

  // The chart renders two series for one price. Never list both values.
  const point = payload.find((entry) => entry.dataKey === "price") ?? payload[0];
  const price = Number(point?.payload?.price ?? point?.value);
  const timestamp = Number(point?.payload?.t ?? label);
  if (!Number.isFinite(price) || !Number.isFinite(timestamp)) return null;

  const date = new Date(timestamp);
  const baseline = startingPrice !== null && Number.isFinite(startingPrice) && startingPrice > 0
    ? startingPrice
    : null;
  const difference = baseline === null ? null : price - baseline;
  const changePercent = baseline === null ? null : ((price - baseline) / baseline) * 100;

  return (
    <div className="pointer-events-none w-[205px] rounded-xl border border-border bg-background px-3 py-2.5 text-foreground shadow-xl" role="status">
      <div className="text-[11px] font-medium text-muted-foreground">
        {date.toLocaleString(undefined, {
          month: "short", day: "numeric", year: "numeric",
          hour: "numeric", minute: "2-digit",
        })}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">Price</span>
        <strong className="text-sm font-bold tabular-nums">{money(price, currency)}</strong>
      </div>
      {difference !== null && changePercent !== null && (
        <div className="mt-2 flex items-start justify-between gap-2 border-t border-border/60 pt-2">
          <span className="text-[11px] leading-4 text-muted-foreground">Since range start</span>
          <div className={`text-right text-[11px] font-semibold tabular-nums ${difference < 0 ? "text-red-500" : "text-foreground"}`}>
            <div>{signedMoney(difference, currency)}</div>
            <div>{changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%</div>
          </div>
        </div>
      )}
    </div>
  );
}
