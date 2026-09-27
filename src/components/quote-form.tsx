"use client";

import { useState } from "react";
import { Button, Field, inputClass } from "./ui";
import { createQuote } from "@/app/app/actions";

/** New quote: title, client, any number of line items with a live total, validity and delivery. */
export function QuoteForm({ currencies, base }: { currencies: { code: string; short: string }[]; base: string }) {
  const [code, setCode] = useState(base);
  const cur = currencies.find((c) => c.code === code)?.short ?? "";
  const [rows, setRows] = useState([{ k: 0, amount: "" }, { k: 1, amount: "" }]);
  const total = rows.reduce((s, r) => s + (Number(r.amount.replace(/[,٬\s]/g, "")) || 0), 0);
  return (
    <form action={createQuote} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الشغلانة"><input name="title" required placeholder="هوية بصرية لكافيه" className={inputClass} /></Field>
        <Field label="العميل"><input name="client" placeholder="كافيه نون" className={inputClass} /></Field>
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">البنود</legend>
        {rows.map((r, i) => (
          <div key={r.k} className="grid grid-cols-[1fr_7rem_auto] gap-2">
            <input name="item_desc" placeholder={i === 0 ? "لوجو + ٣ تعديلات" : "بند"} aria-label={`البند ${i + 1}`} className={inputClass} />
            <input name="item_amount" inputMode="decimal" placeholder={cur} aria-label={`مبلغ البند ${i + 1}`} value={r.amount}
              onChange={(e) => setRows(rows.map((x) => (x.k === r.k ? { ...x, amount: e.target.value } : x)))} className={`${inputClass} num text-left`} />
            <button type="button" onClick={() => setRows(rows.length > 1 ? rows.filter((x) => x.k !== r.k) : rows)}
              className="px-2 text-muted hover:text-risk" aria-label={`شيل البند ${i + 1}`}>✕</button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setRows([...rows, { k: Date.now(), amount: "" }])} className="text-sm font-semibold text-cyan">+ بند كمان</button>
          <span className="text-sm">الإجمالي: <b className="num">{Math.round(total).toLocaleString("en-US")}</b> {cur}</span>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="العرض ساري لمدة (يوم)"><input name="validDays" inputMode="numeric" defaultValue={14} className={`${inputClass} num text-left`} /></Field>
        <Field label="مدة التسليم (يوم)"><input name="deliveryDays" inputMode="numeric" placeholder="اختياري" className={`${inputClass} num text-left`} /></Field>
      </div>
      {currencies.length > 1 && (
        <Field label="العملة">
          <select name="currency" value={code} onChange={(e) => setCode(e.target.value)} className={inputClass}>
            {currencies.map((c) => <option key={c.code} value={c.code}>{c.short}</option>)}
          </select>
        </Field>
      )}
      <Field label="شروط أو ملاحظات"><textarea name="notes" rows={3} placeholder="٥٠٪ مقدم والباقي عند التسليم" className={inputClass} /></Field>
      <Button>اعمل عرض السعر</Button>
    </form>
  );
}
