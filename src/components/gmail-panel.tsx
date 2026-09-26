"use client";

import { useState } from "react";
import { Button, Card, btnClass } from "./ui";
import { Capture } from "./capture";
import { disconnectGmailAction } from "@/app/app/inbox/actions";

type Mail = { id: string; from: string; subject: string; date: string; snippet: string; text: string };

const NOTICES: Record<string, { msg: string; err?: boolean }> = {
  ok: { msg: "اتربط ✓ دوس «هات آخر الإيميلات»." },
  denied: { msg: "ما اتربطش: لغيت الإذن من صفحة Google.", err: true },
  no_scope: { msg: "ما اتربطش: لازم تعلّم على إذن قراءة Gmail في صفحة Google.", err: true },
  no_refresh: { msg: "ما اتربطش. جرّب تاني.", err: true },
  failed: { msg: "ما اتربطش. جرّب تاني.", err: true },
  not_configured: { msg: "ربط Gmail لسه مش متفعّل على الموقع.", err: true },
};

const shortFrom = (f: string) => f.replace(/<[^>]+>/, "").replace(/"/g, "").trim() || f;

export function GmailPanel({ email, configured, notice }: { email: string | null; configured: boolean; notice?: string }) {
  const [mails, setMails] = useState<Mail[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capture, setCapture] = useState<{ key: number; text: string } | null>(null);
  const n = notice ? NOTICES[notice] : undefined;

  async function load() {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/gmail/messages");
      const j = await res.json();
      if (!res.ok) { setError(j.error ?? "حصلت مشكلة. جرّب تاني."); if (j.reconnect) location.reload(); return; }
      setMails(j.mails); setPicked(new Set());
    } catch { setError("النت فصل أو السيرفر مش بيرد. جرّب تاني."); }
    finally { setLoading(false); }
  }

  function toggle(id: string) {
    setPicked((p) => { const next = new Set(p); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }

  function organize() {
    const text = (mails ?? []).filter((m) => picked.has(m.id))
      .map((m) => `From: ${m.from}\nSubject: ${m.subject}\nDate: ${m.date}\n\n${m.text || m.snippet}`).join("\n\n———\n\n");
    setCapture({ key: Date.now(), text });
  }

  return (
    <Card className="grid gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">Gmail</h2>
        {email && <span dir="ltr" className="text-sm text-muted">{email}</span>}
      </div>
      {n && <p role="status" className={`text-sm ${n.err ? "text-risk" : "text-money"}`}>{n.msg}</p>}

      {!configured ? (
        <p className="text-sm text-ink2">ربط Gmail محتاج يتفعّل من إعدادات الموقع الأول. لحد ما يتفعّل: انسخ نص الإيميل والزقه في خانة الشات.</p>
      ) : !email ? (
        <>
          <p className="text-sm text-ink2">اربط Gmail مرة واحدة، وبعدها تختار الإيميلات اللي فيها شغل أو فلوس، والدفتر يطلّع منها المهام والمبالغ.</p>
          <p className="text-[13px] text-muted">الإذن <b className="text-ink">قراءة بس</b>: الدفتر مش هيبعت ولا يمسح أي إيميل، ومش بيحفظ الإيميلات. بيقرا اللي تختاره إنت لما تدوس.</p>
          <a href="/api/gmail/connect" className={btnClass("primary")}>اربط Gmail</a>
        </>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <Button onClick={load} disabled={loading}>{loading ? "بيجيب…" : mails ? "حدّث" : "هات آخر الإيميلات"}</Button>
            <form action={disconnectGmailAction}><Button kind="secondary">افصل Gmail</Button></form>
          </div>
          {error && <p role="alert" className="text-sm text-risk">{error}</p>}
          {mails && mails.length === 0 && <p className="text-sm text-muted">مفيش إيميلات في آخر أسبوعين (من غير العروض والسوشيال).</p>}
          {mails && mails.length > 0 && (
            <>
              <p className="text-[13px] text-muted">آخر أسبوعين. علّم على اللي فيه شغل أو فلوس:</p>
              <ul className="grid max-h-[420px] gap-2 overflow-y-auto">
                {mails.map((m) => (
                  <li key={m.id}>
                    <label className={`flex cursor-pointer gap-2.5 rounded-xl border px-3 py-2.5 ${picked.has(m.id) ? "border-cyan bg-cyan-soft" : "border-rule bg-sheet"}`}>
                      <input type="checkbox" checked={picked.has(m.id)} onChange={() => toggle(m.id)} className="mt-1 size-4 accent-[var(--cyan)]" />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{m.subject || "(من غير عنوان)"}</span>
                        <span className="block truncate text-[13px] text-muted">{shortFrom(m.from)}</span>
                        <span className="line-clamp-2 text-[13px] text-ink2 [overflow-wrap:anywhere]">{m.snippet}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button onClick={organize} disabled={!picked.size}>{picked.size ? `رتّب ${picked.size === 1 ? "الإيميل ده" : `الـ ${picked.size} إيميلات`}` : "علّم على إيميل الأول"}</Button>
            </>
          )}
        </>
      )}
      {capture && <Capture key={capture.key} source="gmail" compact initialText={capture.text} title="راجع ورتّب" />}
    </Card>
  );
}
