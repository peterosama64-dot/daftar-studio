import { prisma, getCurrency } from "./db";
import { CURRENCIES } from "./constants";
import { isMonthKey, monthKey, now } from "./dates";
import { monthTotals } from "./money";
import { bucket, byDue } from "./tasks";

export type SP = Promise<Record<string, string | string[] | undefined>>;

export async function monthFrom(sp: SP) {
  const m = (await sp).m;
  return isMonthKey(m) ? m : monthKey(now());
}

export async function currencyShort() {
  const code = await getCurrency();
  return { code, short: CURRENCIES.find((c) => c.code === code)?.short ?? "ج.م" };
}

/** Everything the dashboard-style pages need for one month. */
export async function loadMonth(month: string) {
  const today = now();
  const [tasks, entries, cur] = await Promise.all([
    prisma.task.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.entry.findMany({ orderBy: { createdAt: "desc" } }),
    currencyShort(),
  ]);
  const urgent = tasks.filter((t) => bucket(t, today) === "urgent").sort(byDue);
  const later = tasks.filter((t) => bucket(t, today) === "later").sort(byDue);
  const doneThisMonth = tasks
    .filter((t) => t.status === "done" && (!t.doneAt || monthKey(t.doneAt) === month))
    .sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0));
  return { today, tasks, entries, urgent, later, doneThisMonth, totals: monthTotals(entries, month), cur };
}
