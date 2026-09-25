"use client";

import { useState } from "react";
import { Button } from "./ui";

export function AiReport({ month, enabled, fallback }: { month: string; enabled: boolean; fallback: string[] }) {
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function write() {
    setBusy(true); setErr(null);
    try {
      const r = await fetch("/api/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ month }) });
      const j = await r.json();
      if (!r.ok) setErr(j.error); else setText(j.text);
    } catch { setErr("النت فصل. جرّب تاني."); }
    finally { setBusy(false); }
  }
  return (
    <div className="grid gap-4">
      <div className="max-w-[62ch] whitespace-pre-wrap text-[16px] leading-loose text-ink2">
        {text ?? fallback.map((l, i) => <p key={i} className="mb-2">{l}</p>)}
      </div>
      {enabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={write} disabled={busy}>{busy ? "بيكتب…" : text ? "اكتبه تاني" : "اكتبلي التقرير"}</Button>
          {err && <span className="text-[13px] text-risk">{err}</span>}
        </div>
      ) : (
        <p className="text-[13px] text-muted">التقرير ده محسوب من أرقامك. لما يتفعّل الترتيب الذكي هيظهر زرار «اكتبلي التقرير» ويكتبه بالعامية.</p>
      )}
    </div>
  );
}
