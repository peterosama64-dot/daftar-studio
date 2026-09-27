import { activeIn, type EntryLike } from "./money";
import { monthKey } from "./dates";

/** Where the money goes. Keys are stored on entries; labels are what the user sees. */
export const CATEGORIES = [
  { key: "software", label: "برامج واشتراكات" },
  { key: "assets", label: "خطوط وصور وستوك" },
  { key: "print", label: "طباعة وخامات" },
  { key: "gear", label: "أجهزة ومعدات" },
  { key: "net", label: "نت وتليفون" },
  { key: "transport", label: "مواصلات" },
  { key: "ads", label: "إعلانات وتسويق" },
  { key: "other", label: "تاني" },
] as const;
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as string[];
export const categoryLabel = (k: string | null | undefined) => CATEGORIES.find((c) => c.key === k)?.label ?? "من غير تصنيف";

/** A category from a form, or null; subscriptions default to software. */
export const pickCategory = (raw: string, kind: string) => (CATEGORY_KEYS.includes(raw) ? raw : kind === "subscription" ? "software" : null);

export type Budgets = Record<string, number>;
export function parseBudgets(raw: string | null | undefined): Budgets {
  try {
    const o = JSON.parse(raw || "{}");
    const out: Budgets = {};
    for (const k of CATEGORY_KEYS) { const v = Number(o?.[k]); if (Number.isFinite(v) && v > 0) out[k] = v; }
    return out;
  } catch { return {}; }
}

export type SpendRow = { key: string | null; label: string; spent: number; budget: number | null; over: boolean; pct: number | null };

/**
 * Spending in month `k` per category (subscriptions billed that month + expenses dated in it), each with
 * its budget. Categories that have a budget always show; over-budget first, then biggest spend.
 */
export function spendByCategory<E extends EntryLike & { category?: string | null }>(entries: E[], k: string, budgets: Budgets): SpendRow[] {
  const m = new Map<string | null, number>();
  for (const e of entries) {
    const counts = activeIn(e, k) || (e.kind === "expense" && !!e.date && monthKey(e.date) === k);
    if (!counts) continue;
    const c = e.category && CATEGORY_KEYS.includes(e.category) ? e.category : null;
    m.set(c, (m.get(c) ?? 0) + (Number(e.amount) || 0));
  }
  for (const c of Object.keys(budgets)) if (!m.has(c)) m.set(c, 0);
  return [...m.entries()].map(([key, spent]) => {
    const budget = key ? budgets[key] ?? null : null;
    return { key, label: categoryLabel(key), spent, budget, over: budget !== null && spent > budget, pct: budget ? Math.round((spent / budget) * 100) : null };
  }).sort((a, b) => Number(b.over) - Number(a.over) || b.spent - a.spent);
}
