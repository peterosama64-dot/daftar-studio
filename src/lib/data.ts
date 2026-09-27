import { prisma, getCurrency } from "./db";
import { CURRENCIES } from "./constants";
import { isMonthKey, monthKey, now } from "./dates";
import { monthTotals } from "./money";
import { bucket, byDue } from "./tasks";
import { makeFx, parseRates } from "./fx";

export type SP = Promise<Record<string, string | string[] | undefined>>;

export async function monthFrom(sp: SP) {
  const m = (await sp).m;
  return isMonthKey(m) ? m : monthKey(now());
}

export async function currencyShort(userId: string) {
  const code = await getCurrency(userId);
  return { code, short: CURRENCIES.find((c) => c.code === code)?.short ?? "ج.م" };
}

/** Everything the dashboard-style pages need for one month. */
export async function loadMonth(month: string, userId: string) {
  const today = now();
  const [tasks, entries, cur] = await Promise.all([
    prisma.task.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, include: { subtasks: { select: { done: true } } } }),
    prisma.entry.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    currencyShort(userId),
  ]);
  const urgent = tasks.filter((t) => bucket(t, today) === "urgent").sort(byDue);
  const later = tasks.filter((t) => bucket(t, today) === "later").sort(byDue);
  const doneThisMonth = tasks
    .filter((t) => t.status === "done" && (!t.doneAt || monthKey(t.doneAt) === month))
    .sort((a, b) => (b.doneAt?.getTime() ?? 0) - (a.doneAt?.getTime() ?? 0));
  return { today, tasks, entries, urgent, later, doneThisMonth, totals: monthTotals(entries, month), cur };
}

/** The account's main currency and exchange rates, for converting other-currency jobs and entries. */
export async function loadFx(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true, fxRates: true } });
  return makeFx(u?.currency ?? "EGP", parseRates(u?.fxRates));
}
