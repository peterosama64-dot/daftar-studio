"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInvoiceLines } from "@/app/app/actions";
import type { QuoteItem } from "@/lib/quote";
import { Button, inputClass } from "./ui";

const n = (s: string) => Number(s.replace(/[,٬\s]/g, "").replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c)))) || 0;

/** The invoice's line items. Saving replaces the job's price with their sum; empty rows go back to one line. */
export function InvoiceLines({ taskId, initial, title, cur }: { taskId: string; initial: QuoteItem[]; title: string; cur: string }) {
  const router = useRouter();
  const [rows, setRows] = useState(() => (initial.length ? initial : [{ desc: title, amount: 0 }]).map((x, i) => ({ k: i, desc: x.desc, amount: x.amount ? String(x.amount) : "" })));
  const [open, setOpen] = useState(initial.length > 1);
  const total = rows.reduce((s, r) => s + n(r.amount), 0);
  const set = (k: number, p: Partial<{ desc: string; amount: string }>) => setRows(rows.map((r) => (r.k === k ? { ...r, ...p } : r)));

  if (!open) {
    return <button type="button" onClick={() => setOpen(true)} className="justify-self-start text-sm font-semibold text-cyan">قسّم الفاتورة لبنود</button>;
  }
  return (
    <form action={async (f) => { await setInvoiceLines(taskId, f); router.refresh(); }} className="grid gap-2">
      <p className="text-sm font-medium">بنود الفاتورة</p>
      {rows.map((r, i) => (
        <div key={r.k} className="grid grid-cols-[1fr_7rem_auto] gap-2">
          <input name="item_desc" value={r.desc} onChange={(e) => set(r.k, { desc: e.target.value })} placeholder="لوجو + ٣ تعديلات"
            aria-label={`البند ${i + 1}`} className={inputClass} />
          <input name="item_amount" value={r.amount} onChange={(e) => set(r.k, { amount: e.target.value })} inputMode="decimal" placeholder={cur}
            aria-label={`مبلغ البند ${i + 1}`} className={`${inputClass} num text-left`} />
          <button type="button" onClick={() => setRows(rows.length > 1 ? rows.filter((x) => x.k !== r.k) : rows)}
            className="px-2 text-muted hover:text-risk" aria-label={`شيل البند ${i + 1}`}>✕</button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={() => setRows([...rows, { k: Date.now(), desc: "", amount: "" }])} className="text-sm font-semibold text-cyan">+ بند كمان</button>
        <span className="text-sm">الإجمالي: <b className="num">{Math.round(total).toLocaleString("en-US")}</b> {cur}</span>
      </div>
      <Button kind="secondary" small className="justify-self-start">احفظ البنود</Button>
      <p className="text-xs text-muted">لما تحفظ، سعر الشغلانة يبقى مجموع البنود.</p>
    </form>
  );
}
