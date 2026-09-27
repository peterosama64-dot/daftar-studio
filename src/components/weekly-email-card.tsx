"use client";

import { useState, useTransition } from "react";
import { sendWeeklyTest, setWeeklyEmail } from "@/app/app/actions";
import { Button, Card, Pill } from "./ui";

/** «ملخص أسبوعي بالإيميل»: on/off, and a test send. */
export function WeeklyEmailCard({ on, configured, email }: { on: boolean; configured: boolean; email: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  return (
    <Card className="grid gap-3 p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">ملخص أسبوعي بالإيميل</h2>
        {!configured ? <Pill tone="waiting">مش متفعّل</Pill> : on ? <Pill tone="money">شغال</Pill> : <Pill>مقفول</Pill>}
      </div>
      <p className="text-sm text-muted">كل جمعة الصبح: اللي خلصته، الفلوس اللي دخلت وخرجت، والمواعيد والدفعات اللي جاية الأسبوع الجاي. بيوصل على <span dir="ltr">{email}</span>.</p>
      {configured ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button small kind={on ? "secondary" : "primary"} disabled={pending} onClick={() => start(async () => { await setWeeklyEmail(!on); setMsg(null); })}>
            {on ? "وقّفه" : "شغّله"}
          </Button>
          <Button small kind="ghost" disabled={pending} onClick={() => start(async () => { const r = await sendWeeklyTest(); setMsg({ text: r.message, ok: r.ok }); })}>
            {pending ? "…" : "ابعتلي نسخة دلوقتي"}
          </Button>
        </div>
      ) : <p className="text-[0.8125rem] text-muted">محتاج حساب في خدمة إرسال إيميلات (Resend) ومفتاحه يتضاف لإعدادات الموقع.</p>}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-money" : "text-risk"}`}>{msg.text}</p>}
    </Card>
  );
}
