import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dayKey, monthName, now, shiftMonth, monthKey } from "@/lib/dates";
import { monthTotals } from "@/lib/money";
import { buildDigest, buildMonthly } from "@/lib/reminders";
import { owedByClient } from "@/lib/owed";
import { makeFx, parseRates } from "@/lib/fx";
import { CURRENCIES } from "@/lib/constants";
import { pushToUser } from "@/lib/push";
import { runRecurring } from "@/lib/recurring";

export const maxDuration = 60;

// Called once a day by Vercel Cron (vercel.json). Each user is "claimed" for today with a conditional
// update before sending, so a repeated or overlapping call never sends the same reminder twice.
// If CRON_SECRET is set, Vercel sends it as a bearer token and anything else is refused.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = now();
  const key = dayKey(today);
  // Monthly jobs first, for every user (not only those with notifications), so today's digest sees them.
  const recurring = await runRecurring(prisma, today);
  const tomorrowEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  const users = await prisma.user.findMany({
    where: { push: { some: {} }, suspendedAt: null, OR: [{ lastDigest: null }, { lastDigest: { not: key } }] },
    select: { id: true, currency: true, fxRates: true },
  });

  let sent = 0, quiet = 0;
  for (const u of users) {
    const claimed = await prisma.user.updateMany({ where: { id: u.id, OR: [{ lastDigest: null }, { lastDigest: { not: key } }] }, data: { lastDigest: key } });
    if (!claimed.count) continue;
    const tasks = await prisma.task.findMany({
      where: { userId: u.id, status: { not: "done" }, due: { not: null, lt: tomorrowEnd } },
      select: { title: true, client: true, due: true, status: true },
      orderBy: { due: "asc" },
      take: 30,
    });
    // Money owed only goes into Sunday's reminder, so only read it then.
    const owed = today.getDay() === 0
      ? owedByClient(await prisma.task.findMany({ where: { userId: u.id, agreed: { gt: 0 } }, select: { id: true, title: true, client: true, agreed: true, paid: true, currency: true } }), makeFx(u.currency, parseRates(u.fxRates)).toBase)
      : null;
    const currency = CURRENCIES.find((c) => c.code === u.currency)?.short ?? "ج.م";
    const dues = (await prisma.installment.findMany({
      where: { userId: u.id, paidAt: null, due: { not: null, lt: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1) } },
      select: { label: true, amount: true, task: { select: { title: true, client: true } } },
      orderBy: { due: "asc" },
      take: 10,
    })).map((d) => ({ label: d.label, amount: d.amount, title: d.task.title, client: d.task.client }));
    const digest = buildDigest(tasks, today, owed ? { total: owed.total, clients: owed.clients.length, currency } : undefined, dues);
    if (!digest) { quiet++; continue; }
    if ((await pushToUser(u.id, { title: digest.title, body: digest.body, url: "/app/tasks" })).sent) sent++;
  }
  // On the 1st, everyone with notifications also gets last month's summary, once (claimed by month).
  let monthly = 0;
  if (today.getDate() === 1) {
    const prev = shiftMonth(monthKey(today), -1);
    const all = await prisma.user.findMany({
      where: { push: { some: {} }, suspendedAt: null, OR: [{ lastMonthly: null }, { lastMonthly: { not: prev } }] },
      select: { id: true, currency: true, incomeGoal: true },
    });
    for (const u of all) {
      const claimed = await prisma.user.updateMany({ where: { id: u.id, OR: [{ lastMonthly: null }, { lastMonthly: { not: prev } }] }, data: { lastMonthly: prev } });
      if (!claimed.count) continue;
      const entries = await prisma.entry.findMany({ where: { userId: u.id } });
      const currency = CURRENCIES.find((c) => c.code === u.currency)?.short ?? "ج.م";
      const m = buildMonthly(monthName(prev), monthTotals(entries, prev), u.incomeGoal, currency);
      if (m && (await pushToUser(u.id, { ...m, url: `/app/report?m=${prev}`, tag: "daftar-monthly" })).sent) monthly++;
    }
  }
  return NextResponse.json({ day: key, users: users.length, sent, quiet, monthly, recurring });
}
