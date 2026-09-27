"use client";

import { useEffect, useState } from "react";
import { formatDuration, hourlyRate, trackedSeconds } from "@/lib/timer";
import { Button } from "./ui";

/** Start/stop the task's timer; while running, the total ticks every second. */
export function TimerCard({ timeSpent, timerStart, agreed, cur, start, stop }: {
  timeSpent: number; timerStart: string | null; agreed: number | null; cur: string; start: () => Promise<void>; stop: () => Promise<void>;
}) {
  const started = timerStart ? new Date(timerStart) : null;
  const [at, setAt] = useState(() => new Date());
  useEffect(() => {
    if (!timerStart) return;
    const t = setInterval(() => setAt(new Date()), 1000);
    return () => clearInterval(t);
  }, [timerStart]);
  const sec = trackedSeconds(timeSpent, started, at);
  const rate = hourlyRate(agreed, sec);
  const clock = started ? (() => { const s = sec % 60; return `:${String(s).padStart(2, "0")}`; })() : "";
  return (
    <div className={`grid gap-2 rounded-xl border p-3.5 ${started ? "border-cyan bg-cyan-soft" : "border-rule bg-paper"}`} aria-label="تايمر المهمة">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs text-muted">{started ? "التايمر شغال" : "وقت الشغل"}</div>
          <div className="font-display text-[1.375rem] font-semibold tabular-nums" aria-live="off">{formatDuration(sec)} <span className="num text-sm font-normal text-muted">{clock}</span></div>
        </div>
        <form action={started ? stop : start}>
          <Button kind={started ? "primary" : "secondary"} small>{started ? "وقّف التايمر" : sec ? "كمّل التايمر" : "ابدأ التايمر"}</Button>
        </form>
      </div>
      {rate !== null && <p className="text-sm text-ink2">الساعة في الشغلانة دي جابت حوالي <b className="num">{Math.round(rate).toLocaleString("en-US")}</b> {cur}.</p>}
    </div>
  );
}
