import { CURRENCIES } from "./constants";

export type Rates = Record<string, number>;

export const curShort = (code: string | null | undefined, fallback = "ج.م") => CURRENCIES.find((c) => c.code === code)?.short ?? fallback;

/** The stored JSON of rates, keeping only known currencies with a positive rate. */
export function parseRates(raw: string | null | undefined): Rates {
  try {
    const o = JSON.parse(raw || "{}");
    const out: Rates = {};
    for (const c of CURRENCIES) { const v = Number(o?.[c.code]); if (Number.isFinite(v) && v > 0) out[c.code] = v; }
    return out;
  } catch { return {}; }
}

/** A money helper for one account: its main currency, its rates, and conversion into the main currency. */
export function makeFx(base: string, rates: Rates) {
  /** The currency an item is in (null = main). */
  const of = (code: string | null | undefined) => (code && code !== base ? code : base);
  /** Currencies the user can pick: the main one, plus those with a rate. */
  const usable = CURRENCIES.filter((c) => c.code === base || rates[c.code]).map((c) => c.code as string);
  const toBase = (amount: number, code: string | null | undefined) => {
    const c = of(code);
    return c === base ? amount : Math.round(amount * (rates[c] ?? 1) * 100) / 100;
  };
  /** In use but without a rate: amounts in it are counted 1:1 until a rate is set. */
  const missing = (code: string | null | undefined) => of(code) !== base && !rates[of(code)];
  return { base, rates, of, usable, toBase, missing, short: (code?: string | null) => curShort(of(code)) };
}
export type Fx = ReturnType<typeof makeFx>;

/** A currency code from a form, allowed only if the account can use it; null means the main currency. */
export function pickCurrency(fx: Fx, raw: string): string | null {
  return raw && raw !== fx.base && fx.usable.includes(raw) ? raw : null;
}
