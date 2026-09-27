import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { monthFrom, type SP } from "@/lib/data";
import { AR_DAYS, clock, dayKey, daysUntil, now, shortDate } from "@/lib/dates";
import { monthGrid, WEEK_DAYS } from "@/lib/calendar";
import { PageHead } from "@/components/month";
import { Card, Empty } from "@/components/ui";

export const metadata = { title: "التقويم" };

type T = { id: string; title: string; client: string; due: Date | null; status: string; priority: string; meeting?: boolean };

export default async function Calendar({ searchParams }: { searchParams: SP }) {
  const uid = await requireUser();
  const month = await monthFrom(searchParams);
  const [y, m] = month.split("-").map(Number);
  const today = now();
  const [tasks, undated, meetings] = await Promise.all([
    prisma.task.findMany({
      where: { userId: uid, due: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } },
      select: { id: true, title: true, client: true, due: true, status: true, priority: true },
      orderBy: [{ due: "asc" }, { createdAt: "asc" }],
    }),
    prisma.task.count({ where: { userId: uid, due: null, status: { not: "done" } } }),
    prisma.meeting.findMany({
      where: { userId: uid, at: { gte: new Date(y, m - 1, 1), lt: new Date(y, m, 1) } },
      select: { id: true, title: true, client: true, at: true },
      orderBy: { at: "asc" },
    }),
  ]);
  const byDay = new Map<string, T[]>();
  // Within a day: urgent first, then normal, then low; ties keep the order they were added.
  const rank: Record<string, number> = { high: 0, normal: 1, low: 2 };
  for (const t of [...tasks].sort((a, b) => a.due!.getTime() - b.due!.getTime() || (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1))) {
    const k = dayKey(t.due!); byDay.set(k, [...(byDay.get(k) ?? []), t]);
  }
  // Meetings go first in their day, by time.
  for (const mt of [...meetings].reverse()) {
    const k = dayKey(mt.at);
    const item: T = { id: mt.id, title: `${clock(mt.at)} ${mt.title}`, client: mt.client, due: mt.at, status: mt.at < today ? "past" : "todo", priority: "normal", meeting: true };
    byDay.set(k, [item, ...(byDay.get(k) ?? [])]);
  }
  const tone = (t: T) =>
    t.meeting ? (t.status === "past" ? "bg-paper text-muted" : "bg-wait-soft text-ink") :
    t.status === "done" ? "bg-paper text-muted line-through"
      : (daysUntil(t.due, today) ?? 0) < 0 ? "bg-risk-soft text-risk"
        : t.priority === "high" ? "bg-risk-soft text-ink" : "bg-cyan-soft text-ink";
  const chip = (t: T) => (
    <Link key={t.id} href={t.meeting ? "/app/meetings" : `/app/tasks/${t.id}`} title={t.client ? `${t.title} · ${t.client}` : t.title}
      className={`block truncate rounded-md px-1.5 py-0.5 text-[0.75rem] hover:outline hover:outline-1 hover:outline-cyan ${tone(t)}`}>{t.title}</Link>
  );
  const open = tasks.filter((t) => t.status !== "done").length;
  return (
    <>
      <PageHead title="التقويم" base="/app/calendar" month={month}
        sub={tasks.length ? `${tasks.length} ${tasks.length === 1 ? "ميعاد" : "مواعيد"} الشهر ده · ${open} لسه` : "مفيش مواعيد تسليم الشهر ده"} />

      {/* Desktop / tablet: month grid */}
      <Card className="hidden overflow-hidden sm:block">
        <div className="grid grid-cols-7 border-b border-rule bg-sunken text-center text-xs text-muted">
          {WEEK_DAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
        </div>
        {monthGrid(month).map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-rule last:border-b-0">
            {week.map((d, di) => {
              if (!d) return <div key={di} className="min-h-28 border-l border-rule bg-paper/50 last:border-l-0" />;
              const list = byDay.get(dayKey(d)) ?? [];
              const isToday = dayKey(d) === dayKey(today);
              return (
                <div key={di} className={`grid min-h-28 content-start gap-1 border-l border-rule p-1.5 last:border-l-0 ${isToday ? "bg-selected" : ""}`}>
                  <span className={`num justify-self-start text-xs ${isToday ? "grid size-6 place-items-center rounded-full bg-cyan font-semibold text-on-accent" : "text-muted"}`}>{d.getDate()}</span>
                  {list.slice(0, 3).map(chip)}
                  {list.length > 3 && <span className="text-[0.6875rem] text-muted">+{list.length - 3} كمان</span>}
                </div>
              );
            })}
          </div>
        ))}
      </Card>

      {/* Phone: agenda by day */}
      <div className="grid gap-3 sm:hidden">
        {byDay.size ? [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, list]) => {
          const d = list[0].due!;
          const isToday = k === dayKey(today);
          return (
            <Card key={k} className={`grid gap-1.5 p-3 ${isToday ? "border-cyan" : ""}`}>
              <div className="text-sm font-semibold">{isToday ? "النهارده · " : ""}{AR_DAYS[d.getDay()]} <span className="num">{shortDate(d)}</span></div>
              {list.map(chip)}
            </Card>
          );
        }) : <Empty>مفيش مواعيد تسليم الشهر ده.</Empty>}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-cyan-soft" />ميعاد</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-wait-soft" />مكالمة أو اجتماع</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-risk-soft" />مستعجل أو متأخر</span>
        <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm border border-rule bg-paper" />خلصت</span>
        <Link href="/app/meetings#cal-h" className="text-cyan">اربطه بتقويم جوجل أو الآيفون ‹</Link>
        {undated > 0 && <Link href="/app/tasks" className="text-cyan">{undated} {undated === 1 ? "مهمة" : "مهام"} من غير ميعاد ‹</Link>}
      </div>
    </>
  );
}
