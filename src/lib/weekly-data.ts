import "server-only";
import { prisma } from "./db";
import { makeFx, parseRates } from "./fx";
import { owedByClient } from "./owed";
import { activeIn } from "./money";
import { monthKey } from "./dates";
import type { WeeklyData } from "./weekly";

/** Where links in emails point: APP_URL, else the production domain Vercel provides. */
export const appUrl = () => (process.env.APP_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")).replace(/\/$/, "");

const DAY = 86_400_000;

/** The numbers for one user's weekly email: the 7 days up to `today` and the 7 days after it. */
export async function weeklyFor(userId: string, today: Date): Promise<{ to: string; data: WeeklyData } | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, name: true, currency: true, fxRates: true } });
  if (!u) return null;
  const fx = makeFx(u.currency, parseRates(u.fxRates));
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 8);
  const [done, entries, upcoming, pays, owedTasks, followUps] = await Promise.all([
    prisma.task.findMany({ where: { userId, status: "done", doneAt: { gte: start } }, select: { title: true, client: true }, orderBy: { doneAt: "asc" }, take: 20 }),
    prisma.entry.findMany({ where: { userId } }),
    prisma.task.findMany({ where: { userId, status: { not: "done" }, due: { gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1), lt: end } }, select: { title: true, client: true, due: true }, orderBy: { due: "asc" }, take: 15 }),
    prisma.installment.findMany({ where: { userId, paidAt: null, due: { lt: end } }, include: { task: { select: { title: true, currency: true } } }, orderBy: { due: "asc" }, take: 15 }),
    prisma.task.findMany({ where: { userId, agreed: { gt: 0 } }, select: { id: true, title: true, client: true, agreed: true, paid: true, currency: true } }),
    prisma.lead.count({ where: { userId, status: { in: ["new", "quoted", "waiting"] }, nextAt: { lt: end } } }),
  ]);
  const inWeek = (d: Date | null) => !!d && d >= start && d.getTime() < start.getTime() + 7 * DAY;
  const income = entries.filter((e) => e.kind === "income" && inWeek(e.date)).reduce((s, e) => s + e.amount, 0);
  const expenses = entries.filter((e) => e.kind === "expense" && inWeek(e.date)).reduce((s, e) => s + e.amount, 0);
  // Subscriptions are monthly: a week carries a quarter of what's billed this month.
  const subs = entries.filter((e) => activeIn(e, monthKey(today))).reduce((s, e) => s + e.amount, 0) / 4;
  return {
    to: u.email,
    data: {
      name: u.name, cur: fx.short(null), appUrl: appUrl(),
      done, income, spent: Math.round(expenses + subs),
      upcoming: upcoming.map((t) => ({ title: t.title, client: t.client, due: t.due! })),
      duePayments: pays.filter((p) => p.due).map((p) => ({ label: p.label, title: p.task.title, amount: fx.toBase(p.amount, p.task.currency), due: p.due! })),
      owed: owedByClient(owedTasks, fx.toBase).total,
      followUps,
    },
  };
}
