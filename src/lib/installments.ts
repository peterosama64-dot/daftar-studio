/** Ready-made splits of a job's price. Amounts are whole numbers; the last payment takes the rounding. */
export const PLANS: { key: string; name: string; parts: [string, number][] }[] = [
  { key: "half", name: "نص ونص", parts: [["مقدم", 50], ["عند التسليم", 50]] },
  { key: "thirds", name: "٣٠ / ٤٠ / ٣٠", parts: [["مقدم", 30], ["نص الشغل", 40], ["عند التسليم", 30]] },
  { key: "deposit", name: "مقدم ٢٠٪", parts: [["مقدم", 20], ["عند التسليم", 80]] },
];

export function splitAmount(total: number, parts: [string, number][]): { label: string; amount: number }[] {
  let used = 0;
  return parts.map(([label, pct], i) => {
    const amount = i === parts.length - 1 ? Math.round((total - used) * 100) / 100 : Math.round((total * pct) / 100);
    used += amount;
    return { label, amount };
  });
}

export type Inst = { amount: number; due: Date | null; paidAt: Date | null };

/** Totals for the payments card: planned, paid, the gap to the agreed price, and the next unpaid payment. */
export function installmentSummary<T extends Inst>(list: T[], agreed: number | null) {
  const planned = list.reduce((s, x) => s + x.amount, 0);
  const paid = list.filter((x) => x.paidAt).reduce((s, x) => s + x.amount, 0);
  const unpaid = list.filter((x) => !x.paidAt);
  const next = [...unpaid].sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity))[0] ?? null;
  return { planned, paid, gap: agreed ? Math.round((agreed - planned) * 100) / 100 : 0, next };
}
