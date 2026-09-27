"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

// Keys are matched by physical position (event.code), so they work the same on an Arabic keyboard layout.
const GO: Record<string, [string, string]> = {
  KeyH: ["/app", "الرئيسية"], KeyT: ["/app/tasks", "الشغل"], KeyM: ["/app/money", "الفلوس"], KeyC: ["/app/clients", "العملاء"],
  KeyL: ["/app/leads", "عملاء محتملين"], KeyQ: ["/app/quotes", "عروض الأسعار"], KeyR: ["/app/report", "التقرير"], KeyS: ["/app/settings", "الإعدادات"],
  KeyA: ["/app/meetings", "المواعيد"], KeyK: ["/app/ask", "اسأل دفترك"], KeyW: ["/app/week", "خطة الأسبوع"],
};
const letter = (code: string) => code.replace("Key", "");

const typing = (el: EventTarget | null) => {
  const t = el as HTMLElement | null;
  return !!t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
};

/** Keyboard shortcuts for the desktop: / search, N new task, G then a letter to jump, ? for the list. */
export function Shortcuts() {
  const router = useRouter();
  const [help, setHelp] = useState(false);
  const pendingG = useRef(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
      if (e.code === "Escape") { setHelp(false); return; }
      if (e.code === "Slash" && e.shiftKey) { e.preventDefault(); setHelp((h) => !h); return; }
      if (Date.now() - pendingG.current < 1200 && GO[e.code]) {
        e.preventDefault(); pendingG.current = 0; setHelp(false); router.push(GO[e.code][0]); return;
      }
      if (e.code === "KeyG") { pendingG.current = Date.now(); return; }
      if (e.code === "Slash") { e.preventDefault(); router.push("/app/search"); return; }
      if (e.code === "KeyN") { e.preventDefault(); router.push("/app/tasks?new=1"); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!help) return null;
  const row = (keys: string, what: string) => (
    <li key={keys} className="flex items-center justify-between gap-6 py-1.5">
      <span>{what}</span>
      <span dir="ltr" className="flex gap-1">{keys.split(" ").map((k) => <kbd key={k} className="rounded-md border border-rule bg-paper px-2 py-0.5 font-mono text-xs">{k}</kbd>)}</span>
    </li>
  );
  return (
    <div role="dialog" aria-modal="true" aria-label="اختصارات الكيبورد" className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setHelp(false)}>
      <div className="w-full max-w-sm rounded-2xl border border-rule bg-sheet p-5 text-sm shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-2 text-lg font-bold">اختصارات الكيبورد</h2>
        <ul className="divide-y divide-rule">
          {row("/", "بحث")}
          {row("N", "مهمة جديدة")}
          {Object.entries(GO).map(([code, [, name]]) => row(`G ${letter(code)}`, `روح لـ${name}`))}
          {row("?", "القايمة دي")}
        </ul>
        <p className="mt-3 text-xs text-muted">شغالة بأي لغة كيبورد. Esc يقفل.</p>
      </div>
    </div>
  );
}
