"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QUEUE_KEY, parseAmount, readQueue, type OfflineOp } from "@/lib/offline";
import { Button, inputClass } from "./ui";

const WARM = ["/app", "/app/tasks", "/app/money", "/app/calendar", "/app/clients"];
const KINDS = [["task", "مهمة"], ["income", "دخل"], ["expense", "مصروف"]] as const;

const load = () => { try { return readQueue(localStorage.getItem(QUEUE_KEY)); } catch { return []; } };
const store = (q: OfflineOp[]) => { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* storage full or blocked */ } };
const today = () => new Date().toLocaleDateString("en-CA");

/**
 * Offline support for the signed-in app: registers the service worker (which keeps the last copy of each
 * page), shows a bar when there's no connection with a small form whose items wait on the phone, and
 * sends them as soon as the connection is back.
 */
export function OfflineKit({ uid }: { uid: string }) {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queue, setQueue] = useState<OfflineOp[]>([]);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<OfflineOp["kind"]>("task");
  const [note, setNote] = useState("");
  const mine = queue.filter((o) => o.uid === uid);

  const flush = useCallback(async () => {
    const pending = load().filter((o) => o.uid === uid);
    if (!pending.length || !navigator.onLine) return;
    try {
      const res = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ops: pending }) });
      if (!res.ok) return;
      const { done = [], rejected = [] } = (await res.json()) as { done?: string[]; rejected?: string[] };
      const gone = new Set([...done, ...rejected]);
      const rest = load().filter((o) => !gone.has(o.id));
      store(rest); setQueue(rest);
      if (done.length) { setNote(`اتبعت ${done.length} ✓`); router.refresh(); setTimeout(() => setNote(""), 4000); }
    } catch { /* still offline; try again on the next "online" */ }
  }, [uid, router]);

  useEffect(() => {
    setQueue(load());
    setOnline(navigator.onLine);
    const up = () => { setOnline(true); flush(); };
    const down = () => setOnline(false);
    // The page's own forms need the server; offline they'd be lost silently, so stop them and offer the offline form.
    const blockSubmit = (e: SubmitEvent) => {
      if (navigator.onLine || (e.target as HTMLElement).closest("[data-offline-ok]")) return;
      e.preventDefault(); e.stopPropagation();
      setOpen(true); setNote("مفيش نت، فالحفظ ده مش هيوصل. سجّلها هنا وهتتبعت لوحدها لما النت يرجع.");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    document.addEventListener("submit", blockSubmit, true);
    flush();
    if ("serviceWorker" in navigator) {
      (async () => {
        try {
          const reg = (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
          await navigator.serviceWorker.ready;
          if (sessionStorage.getItem("daftar-warm") === uid || !navigator.onLine) return;
          sessionStorage.setItem("daftar-warm", uid);
          const assets = performance.getEntriesByType("resource").map((e) => e.name).filter((u) => u.includes("/_next/static/"));
          (reg.active ?? navigator.serviceWorker.controller)?.postMessage({ type: "warm", urls: WARM, assets });
        } catch { /* no service worker (private mode, old browser) */ }
      })();
    }
    return () => { window.removeEventListener("online", up); window.removeEventListener("offline", down); document.removeEventListener("submit", blockSubmit, true); };
  }, [uid, flush]);

  function add(f: FormData) {
    const title = String(f.get("title") ?? "").trim().slice(0, 200);
    const amount = parseAmount(String(f.get("amount") ?? ""));
    if (!title) return;
    if (kind !== "task" && amount === null) { setNote("اكتب المبلغ."); return; }
    const op: OfflineOp = { id: crypto.randomUUID(), uid, kind, title, client: String(f.get("client") ?? "").trim().slice(0, 80), amount, date: today() };
    const q = [...load(), op];
    store(q); setQueue(q); setOpen(false);
    setNote("اتحفظ على الموبايل ✓ هيتبعت لما النت يرجع.");
    if (navigator.onLine) flush();
  }

  if (online && !mine.length && !note) return null;
  return (
    <div role="status" className="sticky top-0 z-40 border-b border-rule bg-wait-soft px-4 py-2 text-sm print:hidden">
      <div className="mx-auto flex max-w-[1120px] flex-wrap items-center gap-x-3 gap-y-1">
        {!online && <span className="font-semibold">مفيش نت — بتشوف آخر نسخة اتفتحت.</span>}
        {mine.length > 0 && <span>{mine.length === 1 ? "حاجة واحدة مستنية" : `${mine.length} حاجات مستنية`} تتبعت{online ? "…" : " لما النت يرجع."}</span>}
        {note && <span>{note}</span>}
        {!online && !open && <Button type="button" small kind="secondary" onClick={() => { setOpen(true); setNote(""); }}>سجّل حاجة</Button>}
        {online && mine.length > 0 && <Button type="button" small kind="secondary" onClick={flush}>ابعت دلوقتي</Button>}
      </div>
      {open && (
        <form action={add} data-offline-ok className="mx-auto mt-2 grid max-w-[1120px] gap-2 sm:grid-cols-[auto_2fr_1fr_1fr_auto]">
          <div className="flex gap-1" role="radiogroup" aria-label="النوع">
            {KINDS.map(([k, l]) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
                className={`rounded-lg border px-2.5 py-1.5 text-sm ${kind === k ? "border-ink bg-ink text-on-accent" : "border-rule bg-sheet"}`}>{l}</button>
            ))}
          </div>
          <input name="title" required placeholder={kind === "task" ? "المهمة" : "عن إيه"} aria-label="العنوان" className={inputClass} />
          <input name="client" placeholder="العميل" aria-label="العميل" className={inputClass} />
          <input name="amount" inputMode="decimal" placeholder={kind === "task" ? "المبلغ (لو فيه)" : "المبلغ"} aria-label="المبلغ" className={`${inputClass} num text-left`} />
          <div className="flex gap-2">
            <Button small>احفظ</Button>
            <Button type="button" kind="ghost" small onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        </form>
      )}
    </div>
  );
}

/** On the login page: forget the saved pages of whoever was signed in before. */
export function ForgetOffline() {
  useEffect(() => {
    navigator.serviceWorker?.getRegistration("/").then((r) => r?.active?.postMessage({ type: "forget" })).catch(() => {});
    try { sessionStorage.removeItem("daftar-warm"); } catch { /* blocked */ }
  }, []);
  return null;
}
