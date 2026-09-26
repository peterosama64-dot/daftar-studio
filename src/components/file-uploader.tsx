"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "./ui";

const MAX_SEND = 3.8 * 1024 * 1024;

/** Big photos are resized in the browser (long side 2400px, JPEG) so they fit the 4 MB upload limit. */
async function shrink(f: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return f;
  const img = await createImageBitmap(f).catch(() => null);
  if (!img) return f;
  const big = Math.max(img.width, img.height);
  if (f.size <= MAX_SEND && big <= 3000) return f;
  const scale = Math.min(1, 2400 / big);
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.86));
  return blob ? new File([blob], f.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }) : f;
}

export function FileUploader({ taskId, round }: { taskId: string; round: number }) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [status, setStatus] = useState<{ msg: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true); setStatus(null);
    let ok = 0; const errors: string[] = [];
    for (const [i, raw] of [...files].entries()) {
      setStatus({ msg: `بيرفع ${i + 1} من ${files.length}…` });
      try {
        const f = await shrink(raw);
        const body = new FormData(); body.append("file", f);
        const r = await fetch(`/api/tasks/${taskId}/files`, { method: "POST", body });
        if (r.ok) ok++; else errors.push(`${raw.name}: ${(await r.json().catch(() => ({}))).error ?? "ما اترفعش"}`);
      } catch { errors.push(`${raw.name}: النت فصل`); }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    setStatus(errors.length ? { msg: errors.join(" · "), err: true } : { msg: `اترفع ${ok === 1 ? "ملف" : `${ok} ملفات`} ✓` });
    router.refresh();
  }
  return (
    <div className="grid gap-1.5">
      <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,application/pdf" className="sr-only" id={`up-${taskId}`}
        onChange={(e) => upload(e.target.files)} />
      <Button kind="secondary" small type="button" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "بيرفع…" : round > 1 ? `ارفع ملفات النسخة ${round}` : "ارفع ملفات التسليم"}
      </Button>
      {status && <p role="status" className={`text-[13px] ${status.err ? "text-risk" : "text-money"}`}>{status.msg}</p>}
    </div>
  );
}
