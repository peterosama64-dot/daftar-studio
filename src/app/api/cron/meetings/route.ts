import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { now } from "@/lib/dates";
import { pushToUser } from "@/lib/push";
import { meetingReminder, reminderWindow } from "@/lib/meetings";

export const maxDuration = 60;

// Called every few minutes (GitHub Actions schedule, .github/workflows/meetings.yml). Sends each meeting's
// «بعد ساعة» push once: the meeting is claimed with a conditional update first, so repeated or overlapping
// calls can't send it twice. Calling it early or often only sends what is already due, so it is safe to
// leave open; if CRON_SECRET is set, the bearer token is required like the daily cron.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const t = now();
  const due = await prisma.meeting.findMany({
    where: { remindedAt: null, at: reminderWindow(t), user: { suspendedAt: null, push: { some: {} } } },
    select: { id: true, userId: true, title: true, client: true, at: true, place: true },
    orderBy: { at: "asc" },
    take: 200,
  });
  let sent = 0;
  for (const m of due) {
    const claimed = await prisma.meeting.updateMany({ where: { id: m.id, remindedAt: null, at: m.at }, data: { remindedAt: t } });
    if (!claimed.count) continue;
    const r = meetingReminder(m, t);
    if ((await pushToUser(m.userId, { ...r, url: "/app/meetings", tag: `daftar-meeting-${m.id}` })).sent) sent++;
  }
  return NextResponse.json({ at: t.toISOString(), due: due.length, sent });
}
