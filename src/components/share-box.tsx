"use client";

import { useState } from "react";
import { Button } from "./ui";

/** The client link for a quote or invoice: make it, copy or share it, or turn it off. */
export function ShareBox({ path, make, revoke, what, label = "لينك للعميل" }: { path: string | null; make: () => Promise<void>; revoke: () => Promise<void>; what: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const url = path && typeof window !== "undefined" ? `${location.origin}${path}` : path;
  async function copy() {
    if (!url) return;
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { await navigator.share({ url, title: what }); return; }
      await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch { /* user closed the share sheet */ }
  }
  if (!path) {
    return (
      <form action={make} className="print:hidden">
        <Button kind="secondary" small>{label}</Button>
      </form>
    );
  }
  return (
    <div className="grid w-full gap-2 rounded-xl border border-cyan bg-cyan-soft p-3 text-sm print:hidden">
      <span>أي حد معاه اللينك ده يقدر يشوف {what}. ابعته للعميل على واتساب أو الإيميل:</span>
      <div className="flex flex-wrap items-center gap-2">
        <input readOnly value={url ?? ""} dir="ltr" aria-label="اللينك" onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-lg border border-rule bg-sheet px-2.5 py-1.5 text-[0.8125rem]" />
        <Button small type="button" onClick={copy}>{copied ? "اتنسخ ✓" : "انسخ"}</Button>
        <form action={revoke}><Button kind="ghost" small>وقّف اللينك</Button></form>
      </div>
    </div>
  );
}
