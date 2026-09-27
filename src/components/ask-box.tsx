"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { askNotebook } from "@/app/app/ask/actions";
import type { Answer } from "@/lib/ask";
import { Button, MicIcon, inputClass } from "./ui";

type Turn = { id: number; q: string; a?: Answer; error?: string };
type Rec = { start(): void; stop(): void; abort(): void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error: string }) => void) | null; onend: (() => void) | null; lang: string; continuous: boolean; interimResults: boolean };
type RecCtor = new () => Rec;

/** Reads an answer aloud in Arabic, when the browser has a voice for it. */
function speak(text: string) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-EG";
    const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith("ar"));
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  } catch { /* no voice: the answer is on screen anyway */ }
}

export function AskBox({ examples }: { examples: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);
  const rec = useRef<Rec | null>(null);
  const [listening, setListening] = useState(false);
  const [micMsg, setMicMsg] = useState<string | null>(null);

  useEffect(() => () => { rec.current?.abort(); try { speechSynthesis.cancel(); } catch { /* unsupported */ } }, []);

  // Tap the mic, say the question; it is asked as soon as you stop talking, and the answer is read back.
  function toggleMic() {
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { setMicMsg("المتصفح ده مش بيسمع صوت. جرّب Chrome، أو اكتب سؤالك."); return; }
    if (listening) { rec.current?.stop(); return; }
    try { speechSynthesis.cancel(); } catch { /* unsupported */ }
    const r = new Ctor();
    r.lang = "ar-EG"; r.continuous = false; r.interimResults = true;
    let heard = "";
    r.onresult = (e) => {
      heard = "";
      for (let i = 0; i < e.results.length; i++) heard += e.results[i][0].transcript;
      setQ(heard);
    };
    r.onerror = (e) => setMicMsg(e.error === "not-allowed" || e.error === "service-not-allowed" ? "اسمح للموقع يستخدم المايك من إعدادات المتصفح." : e.error === "no-speech" ? "ماسمعتش حاجة. جرّب تاني." : "حصلت مشكلة في المايك. جرّب تاني أو اكتب سؤالك.");
    r.onend = () => { setListening(false); if (heard.trim()) ask(heard, true); };
    rec.current = r;
    try { r.start(); setListening(true); setMicMsg(null); } catch { setMicMsg("حصلت مشكلة في المايك. جرّب تاني أو اكتب سؤالك."); }
  }

  const ask = (question: string, spoken = false) => {
    const text = question.trim();
    if (!text || pending) return;
    const id = ++seq.current;
    setTurns((t) => [{ id, q: text }, ...t].slice(0, 20));
    setQ("");
    start(async () => {
      let r: Awaited<ReturnType<typeof askNotebook>>;
      try { r = await askNotebook(text); } catch { r = { error: "حصلت مشكلة في الاتصال. جرّب تاني." }; }
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...("answer" in r ? { a: r.answer } : { error: r.error }) } : x)));
      if (spoken) speak("answer" in r ? r.answer.text : r.error);
      input.current?.focus();
    });
  };

  return (
    <div className="grid gap-4">
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} autoFocus aria-label="سؤالك"
          placeholder="مثلاً: كام دخلت من نون السنة دي؟" className={`${inputClass} flex-1`} />
        <button type="button" onClick={toggleMic} aria-label={listening ? "وقّف التسجيل" : "اسأل بصوتك"} aria-pressed={listening}
          className={`grid size-11 shrink-0 place-items-center rounded-xl border ${listening ? "animate-pulse border-risk bg-risk text-on-accent" : "border-rule bg-sheet text-cyan hover:border-cyan"}`}>
          <MicIcon />
        </button>
        <Button disabled={pending || !q.trim()}>{pending ? "بيفكر…" : "اسأل"}</Button>
      </form>
      {(listening || micMsg) && <p role="status" className={`-mt-2 text-sm ${micMsg ? "text-risk" : "text-muted"}`}>{micMsg ?? "بسمعك… قول سؤالك"}</p>}
      <div className="flex flex-wrap gap-2" aria-label="أمثلة">
        {examples.map((x) => (
          <button key={x} type="button" onClick={() => ask(x)} disabled={pending}
            className="rounded-full border border-rule bg-sheet px-3 py-1.5 text-sm text-ink2 hover:border-cyan hover:text-ink disabled:opacity-50">{x}</button>
        ))}
      </div>
      <ul className="grid gap-3" aria-live="polite">
        {turns.map((t) => (
          <li key={t.id} className="grid gap-2 rounded-2xl border border-rule bg-sheet p-4">
            <p className="text-sm text-muted [overflow-wrap:anywhere]">{t.q}</p>
            {t.error ? <p className="text-risk">{t.error}</p>
              : !t.a ? <p className="animate-pulse text-muted">بيدوّر في دفترك…</p>
                : (
                  <>
                    <p className="text-lg font-semibold [overflow-wrap:anywhere]">{t.a.text}</p>
                    {t.a.lines.length > 0 && (
                      <ul className="grid">
                        {t.a.lines.map((l, i) => {
                          const row = (
                            <>
                              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{l.label}</span>
                              {l.value && <span className="shrink-0 text-ink2">{l.value}</span>}
                            </>
                          );
                          return (
                            <li key={i} className="border-b border-rule last:border-b-0">
                              {l.href ? <Link href={l.href} className="flex gap-3 py-1.5 text-sm hover:text-cyan">{row}</Link> : <div className="flex gap-3 py-1.5 text-sm">{row}</div>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {t.a.href && <Link href={t.a.href} className="justify-self-start text-sm text-cyan">افتح التفاصيل ‹</Link>}
                  </>
                )}
          </li>
        ))}
      </ul>
    </div>
  );
}
