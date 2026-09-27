"use client";

import { useRef, useState } from "react";
import { addEntry } from "@/app/app/actions";
import { shrink } from "./file-uploader";
import { Button, inputClass } from "./ui";
import { CATEGORIES } from "@/lib/categories";

type Guess = { name: string; amount: string; date: string; category: string };

/** «صوّر إيصال»: photo → AI reads the total → the user checks it and saves it as an expense. */
export function ReceiptScan({ defaultDate }: { defaultDate: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err?: boolean } | null>(null);
  const [guess, setGuess] = useState<Guess | null>(null);

  async function pick(raw: File | undefined) {
    if (!raw) return;
    setBusy(true); setMsg(null); setGuess(null);
    try {
      const body = new FormData();
      body.append("file", await shrink(raw, 1600));
      const res = await fetch("/api/receipt", { method: "POST", body });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ text: j.error ?? "حصلت مشكلة، جرّب تاني.", err: true }); return; }
      if (!j.found) {
        setGuess({ name: "", amount: "", date: defaultDate, category: "" });
        setMsg({ text: "مقدرتش أقرا المبلغ من الصورة. اكتبه بإيدك أو صوّر تاني في نور أحسن.", err: true });
        return;
      }
      setGuess({ name: j.name, amount: String(j.amount), date: j.date || defaultDate, category: j.category || "" });
      setMsg({ text: "قريت الإيصال — راجع الأرقام واحفظ." });
    } catch {
      setMsg({ text: "مفيش نت أو حصلت مشكلة، جرّب تاني.", err: true });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function save(f: FormData) {
    await addEntry(f);
    setGuess(null);
    setMsg({ text: "اتسجّل ✓" });
  }

  return (
    <div className="mt-3 grid gap-2">
      <input ref={input} type="file" accept="image/*" capture="environment" className="sr-only" id="receipt-photo"
        onChange={(e) => pick(e.target.files?.[0])} disabled={busy} />
      <label htmlFor="receipt-photo" aria-disabled={busy}
        className={`inline-flex cursor-pointer items-center justify-center gap-1.5 justify-self-start rounded-lg border border-rule bg-sheet px-3 py-1.5 text-sm font-medium hover:bg-sunken ${busy ? "pointer-events-none opacity-60" : ""}`}>
        {busy ? "بقرا الإيصال…" : "📷 صوّر إيصال"}
      </label>
      {msg && <p role="status" className={`text-[0.8125rem] ${msg.err ? "text-risk" : "text-muted"}`}>{msg.text}</p>}
      {guess && (
        <form action={save} key={`${guess.name}|${guess.amount}`} className="grid gap-2 rounded-xl border border-rule bg-paper p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <input type="hidden" name="kind" value="expense" />
          <input name="name" required defaultValue={guess.name} placeholder="المصروف" className={inputClass} aria-label="المصروف من الإيصال" />
          <input name="amount" required inputMode="decimal" defaultValue={guess.amount} placeholder="المبلغ" className={`${inputClass} num text-left`} aria-label="المبلغ من الإيصال" />
          <select name="category" defaultValue={guess.category} aria-label="تصنيف الإيصال" className={inputClass}>
            <option value="">التصنيف</option>
            {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input name="date" type="date" defaultValue={guess.date} className={inputClass} aria-label="تاريخ الإيصال" />
          <Button small>احفظ المصروف</Button>
        </form>
      )}
    </div>
  );
}
