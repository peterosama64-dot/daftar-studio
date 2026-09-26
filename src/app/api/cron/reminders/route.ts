import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { dayKey, now } from "@/lib/dates";
import { buildDigest } from "@/lib/reminders";
import { pushToUser } from "@/lib/push";

export const maxDuration = 60;

// Called once a day by Vercel Cron (vercel.json). Each user is "claimed" for today with a conditional
// update before sending, so a repeated or overlapping call never sends the same reminder twice.
// If CRON_SECRET is set, Vercel sends it as a bearer token and anything else is refused.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = now();
  const key = dayKey(today);
  const tomorrowEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
  const users = await prisma.user.findMany({
    where: { push: { some: {} }, OR: [{ lastDigest: null }, { lastDigest: { not: key } }] },
    select: { id: true },
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
    const digest = buildDigest(tasks, today);
    if (!digest) { quiet++; continue; }
    if ((await pushToUser(u.id, { title: digest.title, body: digest.body, url: "/app/tasks" })).sent) sent++;
  }
  return NextResponse.json({ day: key, users: users.length, sent, quiet });
}
