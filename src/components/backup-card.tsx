"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, btnClass, inputClass } from "./ui";

type Counts = { tasks: number; entries: number; quotes: number; recurring: number; clients: number; templates: number };
const summary = (c: Counts) =>
  [[c.tasks, "مهمة"], [c.entries, "حركة فلوس"], [c.quotes, "عرض سعر"], [c.recurring, "باقة شهرية"], [c.clients, "عميل"], [c.templates, "قالب"]]
    .filter(([n]) => n).map(([n, l]) => `${n} ${l}`).join("، ") || "فاضية";

/** Download everything as one file; restore it here or into a new account (replaces what's there). */
export function BackupCard() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [info, setInfo] = useState<{ counts: Counts; exportedAt: string | null } | null>(null);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(mode: "check" | "restore", f: File, confirm = "") {
    const body = new FormData();
    body.append("file", f); body.append("mode", mode); body.append("confirm", confirm);
    const res = await fetch("/api/backup/restore", { method: "POST", body });
    return { ok: res.ok, j: await res.json().catch(() => ({})) };
  }
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setMsg(null); setInfo(null); setFile(null);
    try {
      const { ok, j } = await send("check", f);
      if (!ok) { setMsg({ text: j.error ?? "حصلت مشكلة.", err: true }); return; }
      setFile(f); setInfo({ counts: j.counts, exportedAt: j.exportedAt });
    } catch { setMsg({ text: "مفيش نت أو حصلت مشكلة.", err: true }); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function restore(fd: FormData) {
    if (!file) return;
    setBusy(true); setMsg(null);
    try {
      const { ok, j } = await send("restore", file, String(fd.get("confirm") ?? ""));
      if (!ok) { setMsg({ text: j.error ?? "حصلت مشكلة.", err: true }); return; }
      setMsg({ text: `اترجعت النسخة ✓ (${summary(j.restored)})` }); setFile(null); setInfo(null);
      router.refresh();
    } catch { setMsg({ text: "مفيش نت أو حصلت مشكلة.", err: true }); }
    finally { setBusy(false); }
  }
  const when = info?.exportedAt ? new Date(info.exportedAt).toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" }) : "";
  return (
    <Card className="grid gap-3 p-5 lg:col-span-2">
      <h2 className="text-lg font-bold">نسخة احتياطية كاملة</h2>
      <p className="text-sm text-muted">ملف واحد فيه كل حاجة: الشغل بخطواته ودفعاته، الفلوس، عروض الأسعار، الباقات، العملاء، القوالب وبياناتك. تقدر ترجّعه هنا أو في حساب جديد.</p>
      <div className="flex flex-wrap items-center gap-2">
        <a href="/api/backup" download className={btnClass("secondary", true)}>نزّل النسخة</a>
        <input ref={input} id="backup-file" type="file" accept="application/json,.json" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
        <label htmlFor="backup-file" className={`inline-flex cursor-pointer items-center rounded-lg border border-rule bg-sheet px-3 py-1.5 text-sm font-medium hover:bg-sunken ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy && !file ? "بقرا الملف…" : "استرجع من ملف"}
        </label>
      </div>
      {info && (
        <form action={restore} className="grid gap-2 rounded-xl border border-risk bg-risk-soft p-3 text-sm">
          <p>النسخة دي{when ? ` (من ${when})` : ""} فيها: <b>{summary(info.counts)}</b>.</p>
          <p className="font-semibold text-risk">الاسترجاع بيمسح كل اللي في حسابك دلوقتي ويحط مكانه اللي في النسخة. لو مش متأكد، نزّل نسخة من حسابك الحالي الأول.</p>
          <div className="flex flex-wrap items-center gap-2">
            <input name="confirm" placeholder="استرجع" aria-label="اكتب استرجع للتأكيد" className={`${inputClass} max-w-40`} />
            <Button kind="danger" small disabled={busy}>{busy ? "بيترجع…" : "استرجع النسخة"}</Button>
            <Button type="button" kind="ghost" small onClick={() => { setInfo(null); setFile(null); }}>إلغاء</Button>
          </div>
        </form>
      )}
      {msg && <p role="status" className={`text-sm ${msg.err ? "text-risk" : "text-money"}`}>{msg.text}</p>}
    </Card>
  );
}
