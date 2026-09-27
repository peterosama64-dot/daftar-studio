import { prisma } from "@/lib/db";
import { isToken } from "@/lib/share";
import { now } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { curShort } from "@/lib/fx";
import { buildIcal, type IcalEvent } from "@/lib/ical";

// The private calendar feed (a secret link, like the other share links): deadlines, meetings and
// payments due, for Google / Apple Calendar to subscribe to. Turning the link off answers 404.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) return new Response("not found", { status: 404 });
  const u = await prisma.user.findUnique({ where: { calendarToken: token, suspendedAt: null }, select: { id: true, name: true, currency: true } });
  if (!u) return new Response("not found", { status: 404 });
  const t = now();
  const from = new Date(t.getFullYear(), t.getMonth(), t.getDate() - 60), to = new Date(t.getFullYear() + 1, t.getMonth(), t.getDate());
  const [tasks, meetings, dues] = await Promise.all([
    prisma.task.findMany({ where: { userId: u.id, status: { not: "done" }, due: { gte: from, lt: to } }, select: { id: true, title: true, client: true, due: true, notes: true }, take: 1000 }),
    prisma.meeting.findMany({ where: { userId: u.id, at: { gte: from, lt: to } }, select: { id: true, title: true, client: true, at: true, place: true, notes: true }, take: 1000 }),
    prisma.installment.findMany({ where: { userId: u.id, paidAt: null, due: { gte: from, lt: to } }, select: { id: true, label: true, amount: true, due: true, task: { select: { id: true, title: true, client: true, currency: true } } }, take: 1000 }),
  ]);
  const origin = new URL(req.url).origin;
  const events: IcalEvent[] = [
    ...tasks.map((x) => ({ uid: `task-${x.id}@daftar-studio`, title: `📌 تسليم: ${x.title}${x.client ? ` (${x.client})` : ""}`, description: x.notes.slice(0, 500) || undefined, url: `${origin}/app/tasks/${x.id}`, day: x.due! })),
    ...meetings.map((m) => ({ uid: `meeting-${m.id}@daftar-studio`, title: `${m.title}${m.client && !m.title.includes(m.client) ? ` · ${m.client}` : ""}`, description: m.notes.slice(0, 500) || undefined, location: m.place || undefined, url: `${origin}/app/meetings`, start: m.at, minutes: 60 })),
    ...dues.map((d) => ({ uid: `pay-${d.id}@daftar-studio`, title: `💰 دفعة «${d.label}»: ${d.task.title} — ${fmt(d.amount)} ${curShort(d.task.currency ?? u.currency)}`, url: `${origin}/app/tasks/${d.task.id}`, day: d.due! })),
  ];
  const body = buildIcal(`دفتر الاستوديو${u.name ? ` — ${u.name}` : ""}`, events, process.env.APP_TIMEZONE || "Africa/Cairo");
  return new Response(body, {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": 'inline; filename="daftar.ics"', "cache-control": "private, no-store" },
  });
}
