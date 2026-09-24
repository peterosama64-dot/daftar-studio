"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, MicIcon, Pill, inputClass } from "./ui";
import { saveParsed } from "@/app/app/actions";
import type { Parsed } from "@/lib/parsed";

type Rec = { start(): void; stop(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onerror: (() => void) | null; onend: (() => void) | null; lang: string; continuous: boolean; interimResults: boolean };
type RecCtor = new () => Rec;

const EXAMPLE = "مثال: «لازم أسلّم لوجو كافيه سُكّر الخميس ومستعجل، واستلمت ٧٥٠٠ من مكتبة الكرمة، وجددت فيجما بـ ٧٢٠»";

export function Capture({ source: fixedSource, initialText = "", title = "قول أو اكتب اللي عندك", compact }: { source?: "chat" | "gmail"; initialText?: string; title?: string; compact?: boolean }) {
  const router = useRouter();
  const [text, setText] = useState(initialText);
  const [listening, setListening] = useState(false);
  const [usedVoice, setUsedVoice] = useState(false);
  const [micHint, setMicHint] = useState(false);
  const [status, setStatus] = useState<{ msg: string; err?: boolean } | null>(null);
  const [draft, setDraft] = useState<Parsed | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, startSave] = useTransition();
  const rec = useRef<Rec | null>(null);

  useEffect(() => () => rec.current?.stop(), []);

  function toggleMic() {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setMicHint(true); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = "ar-EG"; r.continuous = true; r.interimResults = true;
    const start = text ? text.trim() + " " : "";
    r.onresult = (e) => {
      let s = "";
      for (let i = 0; i < e.results.length; i++) s += e.results[i][0].transcript;
      setText(start + s); setUsedVoice(true);
    };
    r.onerror = () => setMicHint(true);
    r.onend = () => setListening(false);
    rec.current = r;
    try { r.start(); setListening(true); setStatus({ msg: "بسمعك… دوس على المايك تاني لما تخلص" }); }
    catch { setMicHint(true); }
  }

  async function organize() {
    if (!text.trim()) { setStatus({ msg: "اكتب أو قول حاجة الأول", err: true }); return; }
    rec.current?.stop();
    setBusy(true); setStatus({ msg: "بقرا وبرتّب…" });
    try {
      const res = await fetch("/api/parse", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
      const j = await res.json();
      if (!res.ok) { setStatus({ msg: j.error ?? "ما عرفتش أرتّب الكلام ده. جرّب تاني.", err: true }); return; }
      if (!j.count) { setStatus({ msg: "ملقتش مهام أو فلوس في الكلام ده. جرّب تكتبه أوضح." }); setDraft(null); return; }
      setDraft(j.data);
      setStatus({ msg: `لقيت ${j.count === 1 ? "حاجة واحدة" : j.count === 2 ? "حاجتين" : `${j.count} حاجات`}. راجعها واحفظ.${j.via === "offline" ? " (ترتيب مبدئي من غير Claude)" : ""}` });
    } catch {
      setStatus({ msg: "النت فصل أو السيرفر مش بيرد. جرّب تاني.", err: true });
    } finally { setBusy(false); }
  }

  function remove(kind: keyof Parsed, i: number) {
    if (!draft) return;
    const next = { ...draft, [kind]: draft[kind].filter((_, j) => j !== i) } as Parsed;
    setDraft(next);
  }

  function save() {
    if (!draft) return;
    const source = fixedSource ?? (usedVoice ? "voice" : "manual");
    startSave(async () => {
      const r = await saveParsed(draft, source);
      if (!r.ok) { setStatus({ msg: "ما اتحفظش. جرّب تاني.", err: true }); return; }
      setDraft(null); setText(""); setUsedVoice(false);
      setStatus({ msg: `اتحفظ ✓ (${r.count})` });
      router.refresh();
    });
  }

  const row = (kind: keyof Parsed, i: number, tone: Parameters<typeof Pill>[0]["tone"], tag: string, body: React.ReactNode, value?: React.ReactNode) => (
    <li key={`${kind}${i}`} className="flex items-center gap-2.5 rounded-xl border border-rule bg-sheet px-3 py-2.5 text-[15px]">
      <Pill tone={tone}>{tag}</Pill>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{body}</span>
      {value}
      <button onClick={() => remove(kind, i)} className="px-1 text-muted hover:text-risk" aria-label="شيل">✕</button>
    </li>
  );

  return (
    <section id="capture" className="grid scroll-mt-6 gap-3.5 rounded-2xl border border-cyan bg-sheet p-4 shadow-[0_0_0_4px_var(--cyan-soft)] lg:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">{title}</h2>
        {!compact && <span className="text-[13px] text-muted">{EXAMPLE}</span>}
      </div>
      <div className="flex items-stretch gap-3">
        {!fixedSource && (
          <button onClick={toggleMic} aria-pressed={listening} aria-label="سجّل بصوتك"
            className={`grid size-14 shrink-0 place-items-center rounded-2xl ${listening ? "bg-risk text-on-accent shadow-[0_0_0_6px_var(--risk-soft)]" : "bg-cyan-soft text-cyan"}`}>
            <MicIcon className="size-6" />
          </button>
        )}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={compact ? 8 : 3}
          placeholder={fixedSource === "chat" ? "الزق المحادثة هنا…" : "اتكلم أو اكتب مهام، فلوس دخلت، اشتراكات دفعتها… كله مرة واحدة"}
          className={`${inputClass} resize-y`} />
      </div>
      {micHint && (
        <p className="text-[13px] text-muted">
          المايك مش متاح هنا. دوس على الخانة واستخدم <b className="text-ink">مايك الكيبورد</b> بتاع موبايلك، أو افتح الموقع من Chrome أو Edge.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={organize} disabled={busy}>{busy ? "بيرتّب…" : "رتّبهالي"}</Button>
        {status && <span role="status" className={`text-[13px] ${status.err ? "text-risk" : "text-muted"}`}>{status.msg}</span>}
      </div>
      {draft && (
        <div className="grid gap-2">
          <ul className="grid gap-2">
            {draft.tasks.map((t, i) => row("tasks", i, t.status === "done" ? "money" : t.priority === "high" ? "urgent" : "later", t.status === "done" ? "خلصت" : "مهمة",
              <>{t.title}{t.client && <span className="text-muted"> · {t.client}</span>}</>, t.due ? <span className="num text-sm text-muted">{t.due.slice(8)}/{Number(t.due.slice(5, 7))}</span> : null))}
            {draft.income.map((m, i) => row("income", i, "money", "دخل", <>{m.name}{m.client && <span className="text-muted"> · {m.client}</span>}</>, <span className="num text-sm text-money">+{m.amount.toLocaleString("en-US")}</span>))}
            {draft.subscriptions.map((m, i) => row("subscriptions", i, "waiting", "اشتراك", <>{m.name} <span className="text-muted">· كل شهر</span></>, <span className="num text-sm text-risk">−{m.amount.toLocaleString("en-US")}</span>))}
            {draft.expenses.map((m, i) => row("expenses", i, "neutral", "مصروف", m.name, <span className="num text-sm text-risk">−{m.amount.toLocaleString("en-US")}</span>))}
          </ul>
          <div className="flex gap-2">
            <Button onClick={save} disabled={saving}>{saving ? "بيحفظ…" : "احفظ الكل"}</Button>
            <Button kind="secondary" onClick={() => { setDraft(null); setStatus(null); }}>إلغاء</Button>
          </div>
        </div>
      )}
    </section>
  );
}
