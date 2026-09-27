"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { planTask, setEstimate } from "@/app/app/actions";

export type BoardTask = { id: string; title: string; client: string; due: string | null; dueLabel: string | null; late: boolean; high: boolean; day: string | null; stale: boolean; hours: string };
export type BoardDay = { key: string; name: string; date: string; today: boolean; past: boolean; load: string; over: boolean; pct: number; tasks: BoardTask[]; meetings: string[] };

/** The week plan: drag a job onto a day (desktop), or pick its day from the list (phone / keyboard). */
export function WeekBoard({ days, unplanned }: { days: BoardDay[]; unplanned: BoardTask[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [over, setOver] = useState<string | null>(null);
  const move = (id: string, day: string) => start(async () => { await planTask(id, day); router.refresh(); });

  const drop = (day: string) => ({
    onDragOver: (e: React.DragEvent) => { e.preventDefault(); setOver(day || "none"); },
    onDragLeave: () => setOver(null),
    onDrop: (e: React.DragEvent) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData("text/task"); if (id) move(id, day); },
  });

  const card = (t: BoardTask) => (
    <li key={t.id} draggable onDragStart={(e) => { e.dataTransfer.setData("text/task", t.id); e.dataTransfer.effectAllowed = "move"; }}
      className={`grid min-w-0 cursor-grab gap-1.5 rounded-xl border bg-sheet p-2.5 text-sm active:cursor-grabbing ${t.late ? "border-risk" : "border-rule"}`}>
      <Link href={`/app/tasks/${t.id}`} className="font-semibold leading-snug hover:text-cyan [overflow-wrap:anywhere]">
        {t.high && <span className="text-risk" aria-label="مستعجل">● </span>}{t.title}
      </Link>
      {(t.client || t.dueLabel) && (
        <p className="text-xs text-muted [overflow-wrap:anywhere]">
          {t.client}{t.client && t.dueLabel ? " · " : ""}{t.dueLabel && <span className={t.late ? "font-semibold text-risk" : ""}>تسليم {t.dueLabel}</span>}
        </p>
      )}
      {t.stale && <p className="text-xs text-wait">كانت متحطوطة على يوم فات</p>}
      <div className="flex items-center gap-1.5">
        <select aria-label={`يوم «${t.title}»`} value={t.stale ? "" : t.day ?? ""} disabled={pending} onChange={(e) => move(t.id, e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-1.5 py-1 text-xs">
          <option value="">مش متوزّعة</option>
          {days.filter((d) => !d.past || d.key === t.day).map((d) => <option key={d.key} value={d.key}>{d.name} {d.date}</option>)}
        </select>
        <form action={async (f) => { await setEstimate(t.id, f); router.refresh(); }} className="flex items-center gap-1">
          <input name="hours" defaultValue={t.hours} key={t.hours} inputMode="decimal" aria-label={`ساعات «${t.title}»`} placeholder="2"
            onBlur={(e) => e.currentTarget.form?.requestSubmit()} className="num w-10 rounded-lg border border-rule bg-paper px-1 py-1 text-center text-xs" />
          <span className="text-xs text-muted">س</span>
        </form>
      </div>
    </li>
  );

  return (
    <div className={`grid gap-4 ${pending ? "opacity-80" : ""}`}>
      <section aria-label="مش متوزّعة" {...drop("")}
        className={`grid content-start gap-2 rounded-2xl border border-dashed p-3 ${over === "none" ? "border-cyan bg-cyan-soft" : "border-rule"}`}>
        <h2 className="flex items-baseline justify-between font-bold">مش متوزّعة <span className="num text-sm font-normal text-muted">{unplanned.length}</span></h2>
        {unplanned.length ? <ul className="grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">{unplanned.map(card)}</ul> : <p className="text-sm text-muted">كل شغلك متوزّع. 👌</p>}
      </section>
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(13rem,1fr))]">
        {days.map((d) => (
          <section key={d.key} aria-label={`${d.name} ${d.date}`} {...drop(d.key)}
            className={`grid min-h-40 min-w-0 content-start gap-2 rounded-2xl border p-2.5 ${over === d.key ? "border-cyan bg-cyan-soft" : d.today ? "border-cyan bg-selected" : "border-rule bg-paper"} ${d.past ? "opacity-60" : ""}`}>
            <div className="grid gap-1">
              <div className="flex items-baseline justify-between gap-1">
                <span className="font-bold">{d.today ? "النهارده" : d.name}</span>
                <span className="num text-xs text-muted">{d.date}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-sunken" aria-hidden="true">
                <div className={`h-full rounded-full ${d.over ? "bg-risk" : "bg-cyan"}`} style={{ width: `${Math.min(100, d.pct)}%` }} />
              </div>
              <span className={`text-xs ${d.over ? "font-semibold text-risk" : "text-muted"}`}>{d.load}</span>
            </div>
            {d.meetings.map((m, i) => <p key={i} className="rounded-md bg-wait-soft px-1.5 py-0.5 text-xs [overflow-wrap:anywhere]">{m}</p>)}
            <ul className="grid gap-2">{d.tasks.map(card)}</ul>
          </section>
        ))}
      </div>
    </div>
  );
}
