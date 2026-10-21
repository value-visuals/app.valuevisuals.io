/** Units used to value precious-metal wallets against XAU/XAG prices per troy ounce. */
export const GRAMS_PER_TROY_OUNCE = 31.1034768;
export const GRAMS_PER_STANDARD_POUND = 453.59237;

export type Metal = "gold" | "silver";

export type MetalWallet = {
  id: string;
  name: string;
  amount: number;
  unit: string;
};

export type MetalHoldings = Record<Metal, MetalWallet[]>;

/**
 * A plain "oz" is a *troy* ounce in this application, in keeping with the
 * existing precious-metals wallet UI. A plain "lb" is a standard (avoirdupois)
 * pound (453.59237 g). No wallet data is rewritten or rounded when converting.
 */
export function toTroyOunces(amount: number, unit: string): number {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Invalid precious-metal wallet quantity");
  }

  const normalized = unit.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  switch (normalized) {
    case "oz":
    case "ozt":
    case "toz":
    case "troy oz":
    case "troy ounce":
    case "troy ounces":
      return amount;
    case "g":
    case "gram":
    case "grams":
      return amount / GRAMS_PER_TROY_OUNCE;
    case "kg":
    case "kilogram":
    case "kilograms":
      return amount * 1000 / GRAMS_PER_TROY_OUNCE;
    case "lb":
    case "lbs":
    case "pound":
    case "pounds":
      return amount * GRAMS_PER_STANDARD_POUND / GRAMS_PER_TROY_OUNCE;
    case "troy lb":
    case "troy pound":
    case "troy pounds":
      return amount * 12;
    default:
      throw new Error(`Unsupported precious-metal unit: ${unit || "(empty)"}`);
  }
}

/** Validate the existing /api/metals/wallets?metal=... response shape. */
export function readMetalWallets(response: unknown, metal: Metal): MetalWallet[] {
  if (typeof response !== "object" || response === null) {
    throw new Error(`Invalid ${metal} wallet response`);
  }
  const wallets = (response as Record<string, unknown>)[metal];
  if (!Array.isArray(wallets)) {
    throw new Error(`Missing ${metal} wallet list`);
  }
  return wallets.map((wallet: unknown, index: number): MetalWallet => {
    if (typeof wallet !== "object" || wallet === null) {
      throw new Error(`Invalid ${metal} wallet at index ${index}`);
    }
    const raw = wallet as Record<string, unknown>;
    const amount = typeof raw.amount === "number" || typeof raw.amount === "string"
      ? Number(raw.amount) : NaN;
    if (!Number.isFinite(amount) || amount < 0 || (typeof raw.amount === "string" && !raw.amount.trim())) {
      throw new Error(`Invalid amount in ${metal} wallet at index ${index}`);
    }
    if (typeof raw.unit !== "string") {
      throw new Error(`Missing unit in ${metal} wallet at index ${index}`);
    }
    // An unknown unit must never be silently valued as zero.
    toTroyOunces(amount, raw.unit);
    return {
      id: typeof raw.id === "string" ? raw.id : `${metal}-${index}`,
      name: typeof raw.name === "string" ? raw.name : `${metal} wallet ${index + 1}`,
      amount,
      unit: raw.unit,
    };
  });
}

export function totalTroyOunces(wallets: MetalWallet[]): number {
  return wallets.reduce((total, wallet) => total + toTroyOunces(wallet.amount, wallet.unit), 0);
}
