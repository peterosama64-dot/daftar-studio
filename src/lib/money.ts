import { monthKey } from "./dates";

export type EntryLike = {
  kind: string;
  name: string;
  client: string;
  amount: number;
  date: Date | null;
  startMonth: string | null;
  endMonth: string | null;
};

/** A subscription is billed in month `k` when it started on/before k and was not stopped before k. */
export const activeIn = (e: EntryLike, k: string) =>
  e.kind === "subscription" && (e.startMonth ?? "0000-00") <= k && (!e.endMonth || e.endMonth >= k);

export function monthTotals<E extends EntryLike>(entries: E[], k: string) {
  const inMonth = (e: E) => !!e.date && monthKey(e.date) === k;
  const income = entries.filter((e) => e.kind === "income" && inMonth(e));
  const subs = entries.filter((e) => activeIn(e, k));
  const expenses = entries.filter((e) => e.kind === "expense" && inMonth(e));
  const sum = (a: E[]) => a.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const I = sum(income), S = sum(subs), X = sum(expenses);
  return { income, subs, expenses, I, S, X, out: S + X, net: I - S - X };
}

export function incomeByClient(entries: EntryLike[]) {
  const m = new Map<string, number>();
  for (const e of entries) {
    const who = e.client || e.name;
    m.set(who, (m.get(who) ?? 0) + e.amount);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const signed = (n: number) => (n < 0 ? "−" : "") + fmt(Math.abs(n));
