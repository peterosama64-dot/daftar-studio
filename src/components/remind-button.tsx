"use client";

import { useId, useState, useTransition } from "react";
import { prepareReminder } from "@/app/app/actions";
import { reminderText, whatsappMessageLink } from "@/lib/remind";
import { Button, btnClass } from "./ui";

/** «فكّره بالدفع»: builds a ready WhatsApp message with the amount and invoice links; editable before sending. */
export function RemindButton({ client }: { client: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [phone, setPhone] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const id = useId();

  function load() {
    setErr("");
    start(async () => {
      try {
        const d = await prepareReminder(client);
        if (!d) { setErr("مفيش فلوس فاضلة على العميل ده."); return; }
        setText(reminderText(d, location.origin));
        setPhone(d.phone);
        setOpen(true);
      } catch { setErr("حصلت مشكلة، جرّب تاني."); }
    });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* no clipboard */ }
  }

  if (!open) {
    return (
      <div className="grid gap-1">
        <Button type="button" kind="secondary" small onClick={load} disabled={pending} className="justify-self-start">
          {pending ? "بجهّز الرسالة…" : "فكّره بالدفع"}
        </Button>
        {err && <span role="alert" className="text-[13px] text-risk">{err}</span>}
      </div>
    );
  }
  return (
    <div className="grid w-full gap-2 rounded-xl border border-rule bg-paper p-3 text-sm">
      <label htmlFor={id} className="text-[13px] text-muted">الرسالة جاهزة — عدّل فيها لو حابب:</label>
      <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={8}
        className="w-full rounded-lg border border-rule bg-sheet px-2.5 py-2 text-[14px] leading-relaxed" />
      <div className="flex flex-wrap items-center gap-2">
        <a href={whatsappMessageLink(phone, text)} target="_blank" rel="noopener noreferrer" className={btnClass("primary", true)}>ابعتها واتساب</a>
        <Button type="button" kind="secondary" small onClick={copy}>{copied ? "اتنسخت ✓" : "انسخ"}</Button>
        <Button type="button" kind="ghost" small onClick={() => setOpen(false)}>اقفل</Button>
      </div>
      {!phone && <p className="text-[13px] text-muted">مفيش رقم محفوظ للعميل ده، فواتساب هيسألك تبعتها لمين. تقدر تحفظ رقمه من صفحة العميل.</p>}
    </div>
  );
}
