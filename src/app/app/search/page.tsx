import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { search } from "@/lib/search";
import { currencyShort } from "@/lib/data";
import { fmt } from "@/lib/money";
import { shortDate } from "@/lib/dates";
import { clientHref } from "@/lib/contact";
import { Card, Empty, Pill, inputClass } from "@/components/ui";

export const metadata = { title: "بحث" };

const KIND: Record<string, string> = { income: "دخل", expense: "مصروف", subscription: "اشتراك" };

export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const uid = await requireUser();
  const q = String((await searchParams).q ?? "").trim().slice(0, 80);
  const [r, cur] = await Promise.all([q.length >= 2 ? search(uid, q) : null, currencyShort(uid)]);
  const count = r ? r.tasks.length + r.entries.length + r.quotes.length + r.clients.length : 0;
  const section = (title: string, n: number, body: React.ReactNode) =>
    n > 0 && <Card className="p-5"><h2 className="mb-2 flex items-baseline justify-between text-lg font-bold">{title}<span className="num text-sm font-normal text-muted">{n}</span></h2>{body}</Card>;
  const row = "flex flex-wrap items-center gap-2 border-b border-rule py-2.5 last:border-b-0 hover:text-cyan";
  return (
    <>
      <form action="/app/search" role="search" className="flex gap-2">
        <input name="q" type="search" defaultValue={q} autoFocus placeholder="دوّر على مهمة، عميل، مبلغ، عرض سعر…" aria-label="بحث" className={`${inputClass} flex-1 text-base`} />
      </form>
      {!r ? <Empty>اكتب حرفين على الأقل.</Empty> : !count ? <Empty>مفيش نتايج لـ «{q}».</Empty> : (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          {section("العملاء", r.clients.length, <ul className="flex flex-wrap gap-2">{r.clients.map((c) => <li key={c}><Link href={clientHref(c)}><Pill tone="later">{c}</Pill></Link></li>)}</ul>)}
          {section("الشغل", r.tasks.length, <ul>{r.tasks.map((t) => (
            <li key={t.id}><Link href={`/app/tasks/${t.id}`} className={row}>
              <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${t.status === "done" ? "text-muted line-through" : "font-medium"}`}>{t.title}</span>
              {t.client && <span className="text-xs text-muted">{t.client}</span>}
              {t.due && t.status !== "done" && <Pill mono>{shortDate(t.due)}</Pill>}
            </Link></li>))}</ul>)}
          {section("الفلوس", r.entries.length, <ul>{r.entries.map((e) => (
            <li key={e.id}><Link href={e.date ? `/app/money?m=${e.date.toISOString().slice(0, 7)}` : "/app/money"} className={row}>
              <Pill tone={e.kind === "income" ? "money" : "urgent"}>{KIND[e.kind] ?? e.kind}</Pill>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{e.name}{e.client ? ` · ${e.client}` : ""}</span>
              <span className="num text-sm">{fmt(e.amount)} {cur.short}</span>
            </Link></li>))}</ul>)}
          {section("عروض الأسعار", r.quotes.length, <ul>{r.quotes.map((x) => (
            <li key={x.id}><Link href={`/app/quotes/${x.id}`} className={row}>
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{x.title}</span>
              {x.client && <span className="text-xs text-muted">{x.client}</span>}
              {x.status === "accepted" ? <Pill tone="money">اتوافق</Pill> : <Pill tone="waiting">مستني</Pill>}
            </Link></li>))}</ul>)}
        </div>
      )}
    </>
  );
}
