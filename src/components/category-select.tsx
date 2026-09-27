"use client";

import { CATEGORIES } from "@/lib/categories";
import { inputClass } from "./ui";

/** A category picker that saves as soon as it changes. */
export function CategorySelect({ action, value, label }: { action: (f: FormData) => Promise<void>; value: string | null; label: string }) {
  return (
    <form action={action}>
      <select name="category" defaultValue={value ?? ""} aria-label={label} onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className={`${inputClass} w-auto px-2 py-1 text-xs`}>
        <option value="">من غير تصنيف</option>
        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
    </form>
  );
}
