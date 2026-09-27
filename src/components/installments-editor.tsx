"use client";

import { useState } from "react";
import { PLANS, splitAmount } from "@/lib/installments";
import { fmt } from "@/lib/money";
import { Button, inputClass } from "./ui";

type Row = { label: string; amount: string; due: string };

/** Plan the unpaid payments: pick a ready split of what's left, or type rows by hand. */
export function InstallmentsEditor({ action, left, initial, cur }: { action: (f: FormData) => Promise<void>; left: number; initial: Row[]; cur: string }) {
  const [rows, setRows] = useState<Row[]>(initial.length ? initial : [{ label: "مقدم", amount: "", due: "" }]);
  const total = rows.reduce((s, r) => s + (Number(r.amount.replace(/[,٬\s]/g, "")) || 0), 0);
  const set = (i: number, k: keyof Row, v: string) => setRows(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <form action={action} className="grid gap-3">
      {left > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">قسّم الباقي ({fmt(left)}):</span>
          {PLANS.map((p) => (
            <Button key={p.key} type="button" kind="secondary" small
              onClick={() => setRows(splitAmount(left, p.parts).map((x, i) => ({ label: x.label, amount: String(x.amount), due: rows[i]?.due ?? "" })))}>
              {p.name}
            </Button>
          ))}
        </div>
      )}
      <ul className="grid gap-2">
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_7rem_auto] gap-2 sm:grid-cols-[1fr_8rem_10rem_auto]">
            <input name="label" value={r.label} onChange={(e) => set(i, "label", e.target.value)} placeholder="اسم الدفعة" aria-label={`اسم الدفعة ${i + 1}`} className={inputClass} />
            <input name="amount" value={r.amount} onChange={(e) => set(i, "amount", e.target.value)} inputMode="decimal" placeholder="المبلغ" aria-label={`مبلغ الدفعة ${i + 1}`} className={`${inputClass} num text-left`} />
            <input name="due" type="date" value={r.due} onChange={(e) => set(i, "due", e.target.value)} aria-label={`ميعاد الدفعة ${i + 1}`} className={`${inputClass} col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto`} />
            <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} aria-label={`شيل الدفعة ${i + 1}`} className="px-1 text-muted hover:text-risk">✕</button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button type="button" kind="ghost" small onClick={() => setRows([...rows, { label: "", amount: "", due: "" }])}>+ دفعة كمان</Button>
        <span className={left > 0 && Math.abs(total - left) > 0.5 ? "text-wait" : "text-muted"}>
          المجموع <span className="num">{fmt(total)}</span>{left > 0 && <> من <span className="num">{fmt(left)}</span></>} {cur}
        </span>
      </div>
      <Button small className="justify-self-start">احفظ الدفعات</Button>
    </form>
  );
}
