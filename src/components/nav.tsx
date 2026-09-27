"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Brand, MicIcon } from "./ui";

const ITEMS = [
  { href: "/app", label: "الرئيسية" },
  { href: "/app/tasks", label: "الشغل" },
  { href: "/app/calendar", label: "التقويم" },
  { href: "/app/recurring", label: "شغل شهري" },
  { href: "/app/leads", label: "عملاء محتملين" },
  { href: "/app/quotes", label: "عروض الأسعار" },
  { href: "/app/templates", label: "القوالب" },
  { href: "/app/money", label: "الفلوس" },
  { href: "/app/inbox", label: "الرسايل" },
  { href: "/app/report", label: "التقرير" },
  { href: "/app/clients", label: "العملاء" },
  { href: "/app/settings", label: "الإعدادات" },
];
const MORE = ["/app/search", "/app/calendar", "/app/recurring", "/app/leads", "/app/quotes", "/app/templates", "/app/inbox", "/app/report", "/app/clients", "/app/settings", "/app/more"];

const isActive = (path: string, href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));

function withMonth(href: string, m: string | null) {
  return m ? `${href}?m=${m}` : href;
}

export function Sidebar() {
  const path = usePathname();
  const sp = useSearchParams();
  const m = sp.get("m");
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-8 border-l border-rule bg-sheet px-4 py-7 lg:flex print:hidden">
      <Brand href="/app" />
      <form action="/app/search" role="search">
        <input name="q" type="search" placeholder="بحث…" aria-label="بحث" defaultValue={path.startsWith("/app/search") ? (sp.get("q") ?? "") : ""}
          className="w-full rounded-[10px] border border-rule bg-paper px-3 py-2 text-sm placeholder:text-muted focus:border-cyan focus:outline-none" />
      </form>
      <nav className="grid gap-0.5" aria-label="الأقسام">
        {ITEMS.map((i) => {
          const on = isActive(path, i.href);
          return (
            <Link key={i.href} href={withMonth(i.href, m)} aria-current={on ? "page" : undefined}
              className={`rounded-[10px] px-3.5 py-2.5 ${on ? "bg-cyan-soft font-semibold text-ink" : "text-ink2 hover:bg-paper"}`}>
              {i.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export function TabBar() {
  const path = usePathname();
  const m = useSearchParams().get("m");
  const tab = (href: string, label: string, on: boolean) => (
    <Link href={withMonth(href, m)} aria-current={on ? "page" : undefined} className="flex flex-1 flex-col items-center gap-1.5 py-1">
      <span className={`h-[3px] w-6 rounded ${on ? "bg-cyan" : "bg-transparent"}`} />
      <span className={`text-[11px] ${on ? "font-semibold text-ink" : "text-muted"}`}>{label}</span>
    </Link>
  );
  return (
    <nav aria-label="الأقسام" className="fixed inset-x-0 bottom-0 z-30 flex items-end gap-1 border-t border-rule bg-sheet px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+14px)] lg:hidden print:hidden">
      {tab("/app", "الرئيسية", path === "/app")}
      {tab("/app/tasks", "الشغل", path.startsWith("/app/tasks"))}
      <Link href={withMonth("/app", m) + "#capture"} aria-label="سجّل بصوتك"
        className="-mt-5 grid size-[52px] place-items-center rounded-2xl bg-cyan text-on-accent shadow-float">
        <MicIcon className="size-6" />
      </Link>
      {tab("/app/money", "الفلوس", path.startsWith("/app/money"))}
      {tab("/app/more", "المزيد", MORE.some((p) => path.startsWith(p)))}
    </nav>
  );
}
