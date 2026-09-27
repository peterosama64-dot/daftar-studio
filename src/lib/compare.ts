import { incomeByClient, monthTotals, type EntryLike } from "./money";
import { monthKey, shiftMonth } from "./dates";

type TaskLike = { client: string; status: string; doneAt: Date | null; timeSpent: number; agreed: number | null; createdAt: Date };

export type MonthStats = {
  k: string; I: number; out: number; net: number; done: number; hours: number;
  rate: number | null; clients: number; newClients: number; top: { name: string; amount: number } | null;
};

/** One month's numbers for side-by-side comparison. «New» clients are those whose first ever income or job falls in the month. */
export function monthStats<E extends EntryLike>(entries: E[], tasks: TaskLike[], k: string, firstSeen: Map<string, string>): MonthStats {
  const t = monthTotals(entries, k);
  const doneTasks = tasks.filter((x) => x.status === "done" && x.doneAt && monthKey(x.doneAt) === k);
  const secs = doneTasks.reduce((s, x) => s + x.timeSpent, 0);
  const tracked = doneTasks.filter((x) => x.agreed && x.timeSpent >= 900);
  const trackedSecs = tracked.reduce((s, x) => s + x.timeSpent, 0);
  const byClient = incomeByClient(t.income);
  const names = new Set(t.income.map((e) => e.client).filter(Boolean));
  for (const x of doneTasks) if (x.client) names.add(x.client);
  return {
    k, I: t.I, out: t.out, net: t.net, done: doneTasks.length,
    hours: Math.round(secs / 360) / 10,
    rate: trackedSecs ? tracked.reduce((s, x) => s + (x.agreed ?? 0), 0) / (trackedSecs / 3600) : null,
    clients: names.size,
    newClients: [...names].filter((n) => firstSeen.get(n) === k).length,
    top: byClient[0] ? { name: byClient[0][0], amount: byClient[0][1] } : null,
  };
}

/** The month each client first appears (earliest income or job). */
export function clientFirstSeen<E extends EntryLike>(entries: E[], tasks: TaskLike[]) {
  const first = new Map<string, string>();
  const see = (name: string, d: Date | null) => {
    if (!name || !d) return;
    const k = monthKey(d);
    if (!first.has(name) || k < first.get(name)!) first.set(name, k);
  };
  for (const e of entries) if (e.kind === "income") see(e.client, e.date);
  for (const t of tasks) see(t.client, t.createdAt);
  return first;
}

/** This month, the one before, and the same month a year earlier. */
export function compareMonths<E extends EntryLike>(entries: E[], tasks: TaskLike[], k: string) {
  const first = clientFirstSeen(entries, tasks);
  const [now, prev, lastYear] = [k, shiftMonth(k, -1), shiftMonth(k, -12)].map((m) => monthStats(entries, tasks, m, first));
  return { now, prev, lastYear };
}

/** Change from `b` to `a` in percent; null when there is nothing to compare against. */
export const change = (a: number | null, b: number | null) => (a === null || b === null || b === 0 ? null : Math.round(((a - b) / Math.abs(b)) * 100));
