"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { askNotebook } from "@/app/app/ask/actions";
import type { Answer } from "@/lib/ask";
import { Button, inputClass } from "./ui";

type Turn = { id: number; q: string; a?: Answer; error?: string };

export function AskBox({ examples }: { examples: string[] }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [q, setQ] = useState("");
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    const id = ++seq.current;
    setTurns((t) => [{ id, q: text }, ...t].slice(0, 20));
    setQ("");
    start(async () => {
      let r: Awaited<ReturnType<typeof askNotebook>>;
      try { r = await askNotebook(text); } catch { r = { error: "حصلت مشكلة في الاتصال. جرّب تاني." }; }
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, ...("answer" in r ? { a: r.answer } : { error: r.error }) } : x)));
      input.current?.focus();
    });
  };

  return (
    <div className="grid gap-4">
      <form onSubmit={(e) => { e.preventDefault(); ask(q); }} className="flex gap-2">
        <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} maxLength={300} autoFocus aria-label="سؤالك"
          placeholder="مثلاً: كام دخلت من نون السنة دي؟" className={`${inputClass} flex-1`} />
        <Button disabled={pending || !q.trim()}>{pending ? "بيفكر…" : "اسأل"}</Button>
      </form>
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
