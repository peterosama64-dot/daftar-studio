"use client";

/* eslint-disable @next/next/no-img-element -- the logo comes from Blob storage */
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { shrink } from "./file-uploader";
import { Button } from "./ui";

/** Pick a logo for invoices and quotes; big images are resized in the browser first. */
export function LogoUpload({ url }: { url: string | null }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send(raw: File | undefined) {
    if (!raw) return;
    setBusy(true); setErr("");
    try {
      const body = new FormData();
      body.append("file", raw.type === "image/png" && raw.size < 300_000 ? raw : await shrink(raw, 600));
      const res = await fetch("/api/logo", { method: "POST", body });
      if (!res.ok) { setErr((await res.json().catch(() => ({}))).error ?? "حصلت مشكلة، جرّب تاني."); return; }
      router.refresh();
    } catch { setErr("مفيش نت أو حصلت مشكلة، جرّب تاني."); }
    finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function remove() {
    setBusy(true);
    await fetch("/api/logo", { method: "DELETE" }).catch(() => null);
    setBusy(false); router.refresh();
  }
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">اللوجو</span>
      <div className="flex flex-wrap items-center gap-3">
        {url ? <img src={url} alt="اللوجو" className="max-h-14 max-w-36 rounded border border-rule bg-white object-contain p-1" />
          : <span className="grid h-14 w-24 place-items-center rounded border border-dashed border-rule text-xs text-muted">مفيش لوجو</span>}
        <input ref={input} id="logo-file" type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => send(e.target.files?.[0])} disabled={busy} />
        <label htmlFor="logo-file" className={`inline-flex cursor-pointer items-center rounded-lg border border-rule bg-sheet px-3 py-1.5 text-sm font-medium hover:bg-sunken ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "بيترفع…" : url ? "غيّر اللوجو" : "ارفع لوجو"}
        </label>
        {url && <Button type="button" kind="ghost" small onClick={remove} disabled={busy}>شيله</Button>}
      </div>
      {err && <p role="alert" className="text-[0.8125rem] text-risk">{err}</p>}
      <p className="text-[0.8125rem] text-muted">PNG بخلفية شفافة أحسن حاجة. بيظهر فوق الفاتورة وعرض السعر.</p>
    </div>
  );
}
