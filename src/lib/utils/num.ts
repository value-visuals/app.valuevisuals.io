export const toMs = (t: number | string | Date) =>
  typeof t === "number"
    ? t > 1e12
      ? t
      : t * 1000 // seconds→ms if needed
    : Date.parse(String(t));

export const toNum = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
};
export const toNumNull = (n: unknown): number | null => {
  const x = typeof n === "string" ? Number(n) : typeof n === "number" ? n : NaN;
  return Number.isFinite(x) ? x : null;
};
export const formatPercent = (fraction: number | null | undefined) => {
  return fraction == null ? "—" : `${(fraction * 100).toFixed(2)}%`;
};
export const formatIntegerish = (x: Integerish): string => {
  // Coerce to integer string and group
  let s = typeof x === "string" ? x : Math.trunc(Number(x)).toString();
  s = s.replace(/[^\d-]/g, ""); // strip anything weird
  const neg = s.startsWith("-");
  const abs = neg ? s.slice(1) : s;
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return neg ? `-${grouped}` : grouped;
};
export const sats = (n: Integerish) => {
  return `${formatIntegerish(n)} sats`;
};

// ---- ETH formatting (wei -> ETH) with BigInt-safe rounding ----
export const toBigIntClean = (x: Integerish): { neg: boolean; abs: bigint } => {
  let s = typeof x === "string" ? x : Math.trunc(Number(x)).toString();
  s = s.trim();
  let neg = false;
  if (s.startsWith("-")) {
    neg = true;
    s = s.slice(1);
  }
  s = s.replace(/[^\d]/g, "");
  if (s.length === 0) s = "0";
  return { neg, abs: BigInt(s) };
};

export const groupThousands = (s: string): string => {
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const eth = (x: Integerish, places = 6): string => {
  const { neg, abs } = toBigIntClean(x);
  const decimals = Math.max(0, Math.min(18, places));
  const factor = 10n ** BigInt(18 - decimals);

  const rounded = (abs + factor / 2n) / factor;
  const scale = 10n ** BigInt(decimals);

  const intPart = rounded / scale;
  const fracPart = rounded % scale;

  const sign = neg ? "-" : "";
  const intStr = groupThousands(intPart.toString());

  if (decimals === 0 || fracPart === 0n) {
    return `${sign}${intStr} ETH`;
  }

  const fracStr = fracPart
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");

  return `${sign}${intStr}.${fracStr} ETH`;
};

// Accepts either unix seconds or "YYYY-MM-DD"
export const fmtDate = (t: number | string): string => {
  if (typeof t === "number" && Number.isFinite(t)) {
    return new Date(t * 1000).toISOString().slice(0, 10);
  }
  if (typeof t === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const n = Number(t);
    if (Number.isFinite(n))
      return new Date(n * 1000).toISOString().slice(0, 10);
    const d = new Date(t);
    if (!Number.isNaN(+d)) return d.toISOString().slice(0, 10);
    return t;
  }
  return "—";
};

export const fmtUSD = (n: number) =>
  new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(n);

export const sumBigintWalletField = (
  wallets: WalletStat[],
  key: keyof WalletStat,
): bigint => {
  const toBig = (x: Integerish) =>
    BigInt(
      String(
        typeof x === "string" ? x.trim() || "0" : Math.trunc(Number(x)) || 0,
      ),
    );
  return wallets.reduce<bigint>(
    (acc, w) => acc + toBig(w[key] as Integerish),
    0n,
  );
};

export const convertUsd = (n: string | number, type: CoinType) => {
  return type === "bitcoin" ? toNum(n) / 1e8 : toNum(n) / 1e18;
};
