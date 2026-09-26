import { activeIn, incomeByClient, monthTotals, type EntryLike } from "./money";

type TaskLike = { status: string; doneAt: Date | null; timeSpent: number };

/**
 * A whole year: each month's totals, the year's totals, top clients, what each subscription cost, work done.
 * Months after `until` ("YYYY-MM", e.g. this month) haven't happened yet and count as zero.
 */
export function yearSummary<E extends EntryLike>(entries: E[], tasks: TaskLike[], year: number, until = "9999-12") {
  const months = Array.from({ length: 12 }, (_, i) => {
    const k = `${year}-${String(i + 1).padStart(2, "0")}`;
    if (k > until) return { k, I: 0, S: 0, X: 0, net: 0 };
    const t = monthTotals(entries, k);
    return { k, I: t.I, S: t.S, X: t.X, net: t.net };
  });
  const sum = (f: (m: (typeof months)[number]) => number) => months.reduce((s, m) => s + f(m), 0);
  const I = sum((m) => m.I), S = sum((m) => m.S), X = sum((m) => m.X), net = I - S - X;
  const income = entries.filter((e) => e.kind === "income" && e.date && e.date.getFullYear() === year);
  const subs = entries
    .filter((e) => e.kind === "subscription")
    .map((e) => {
      const n = months.filter((m) => m.k <= until && activeIn(e, m.k)).length;
      return { name: e.name, months: n, total: n * e.amount };
    })
    .filter((s) => s.months > 0)
    .sort((a, b) => b.total - a.total);
  const done = tasks.filter((t) => t.status === "done" && t.doneAt && t.doneAt.getFullYear() === year).length;
  const best = months.reduce((b, m) => (m.I > b.I ? m : b), months[0]);
  return {
    months, I, S, X, net,
    margin: I ? Math.round((net / I) * 100) : 0,
    clients: incomeByClient(income).slice(0, 8),
    subs, done,
    hours: Math.round(tasks.reduce((s, t) => s + t.timeSpent, 0) / 360) / 10,
    best: best.I > 0 ? best.k : null,
    activeMonths: months.filter((m) => m.I > 0).length,
  };
}
