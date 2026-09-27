"use client";

import { useEffect, useState } from "react";
import { shareCalendar, unshareCalendar } from "@/app/app/actions";
import { Button, Card } from "./ui";

/** The private iCal link: add it once to Google / Apple Calendar and deadlines, meetings and payments show up there. */
export function CalendarFeed({ path }: { path: string | null }) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(location.origin), []);
  const url = path ? `${origin}${path}` : "";
  const webcal = url.replace(/^https?:/, "webcal:");
  const google = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`;
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ }
  }
  return (
    <Card className="grid gap-3 p-5" aria-labelledby="cal-h">
      <h2 id="cal-h" className="text-lg font-bold">اربطها بتقويم جوجل أو الآيفون</h2>
      <p className="text-sm text-muted">مواعيد التسليم والمكالمات والدفعات المستحقة تظهر في تقويم موبايلك، وتتحدّث لوحدها كل كام ساعة.</p>
      {!path ? (
        <form action={shareCalendar}><Button>اعمل لينك التقويم</Button></form>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <a href={google} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-paper">ضيفه لتقويم جوجل</a>
            <a href={webcal} className="rounded-xl border border-rule bg-sheet px-4 py-2.5 text-sm font-semibold">ضيفه للآيفون / الماك</a>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input readOnly value={url} dir="ltr" aria-label="لينك التقويم" onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded-lg border border-rule bg-paper px-2.5 py-1.5 text-[0.8125rem]" />
            <Button small kind="secondary" type="button" onClick={copy}>{copied ? "اتنسخ ✓" : "انسخ"}</Button>
          </div>
          <details className="text-sm text-muted">
            <summary className="cursor-pointer text-cyan">لو الزرار ماشتغلش</summary>
            <p className="mt-1">في تقويم جوجل على الكمبيوتر: «تقاويم تانية» ← «+» ← «من عنوان URL»، والصق اللينك.</p>
          </details>
          <p className="text-xs text-muted">اللينك ده سري: أي حد معاه يشوف مواعيدك. لو اتشارك بالغلط، وقّفه واعمل واحد جديد.</p>
          <form action={unshareCalendar}><button className="text-sm text-risk">وقّف اللينك</button></form>
        </>
      )}
    </Card>
  );
}
