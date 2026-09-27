import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { fmt } from "@/lib/money";
import { dayKey, now, shortDate } from "@/lib/dates";
import { whatsappLink } from "@/lib/contact";
import { LEAD_STAGES, followUpDue, leadStats } from "@/lib/leads";
import { PageHead } from "@/components/month";
import { Button, Card, Empty, Field, Pill, SectionHead, inputClass } from "@/components/ui";
import { addLead, deleteLead, setLeadStatus, snoozeLead, updateLead, winLead } from "../actions";

export const metadata = { title: "عملاء محتملين" };

type L = Awaited<ReturnType<typeof prisma.lead.findMany>>[number];

export default async function Leads({ searchParams }: { searchParams: Promise<{ closed?: string }> }) {
  const uid = await requireUser();
  const [leads, cur, sp] = await Promise.all([
    prisma.lead.findMany({ where: { userId: uid }, orderBy: [{ nextAt: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }] }),
    currencyShort(uid),
    searchParams,
  ]);
  const today = now();
  const due = new Set(followUpDue(leads, today).map((l) => l.id));
  const s = leadStats(leads, today);
  const closed = leads.filter((l) => l.status === "won" || l.status === "lost").sort((a, b) => (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));

  const card = (l: L) => {
    const wa = l.contact && !l.contact.includes("@") ? whatsappLink(l.contact) : null;
    const idx = LEAD_STAGES.findIndex((x) => x.key === l.status);
    const next = LEAD_STAGES[idx + 1];
    return (
      <li key={l.id} className={`grid gap-2 rounded-xl border bg-sheet p-3 ${due.has(l.id) ? "border-wait" : "border-rule"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{l.name}</span>
          {l.budget ? <span className="num text-sm">{fmt(l.budget)}</span> : null}
        </div>
        {l.need && <p className="text-sm text-ink2 [overflow-wrap:anywhere]">{l.need}</p>}
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {l.source && <Pill>{l.source}</Pill>}
          {l.nextAt && <Pill tone={due.has(l.id) ? "waiting" : "neutral"} mono>{due.has(l.id) ? "تابع النهارده" : `تابع ${shortDate(l.nextAt)}`}</Pill>}
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="text-cyan">واتساب</a>}
          {l.contact.includes("@") && <a href={`mailto:${l.contact}`} className="text-cyan">إيميل</a>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {next && <form action={setLeadStatus.bind(null, l.id, next.key)}><Button kind="secondary" small>← {next.label}</Button></form>}
          <form action={winLead.bind(null, l.id)}><Button small>اتفقنا</Button></form>
          <form action={setLeadStatus.bind(null, l.id, "lost")}><Button kind="ghost" small>مانفعش</Button></form>
          {due.has(l.id) && <form action={snoozeLead.bind(null, l.id, 3)}><Button kind="ghost" small>بعد ٣ أيام</Button></form>}
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-cyan">تفاصيل</summary>
          <form action={updateLead.bind(null, l.id)} className="mt-2 grid gap-2">
            <input name="name" defaultValue={l.name} required aria-label="الاسم" className={inputClass} />
            <input name="contact" defaultValue={l.contact} dir="ltr" placeholder="موبايل أو إيميل" aria-label="التواصل" className={`${inputClass} text-left`} />
            <input name="need" defaultValue={l.need} placeholder="عايز إيه" aria-label="عايز إيه" className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <input name="budget" defaultValue={l.budget ?? ""} inputMode="decimal" placeholder="الميزانية" aria-label="الميزانية" className={`${inputClass} num text-left`} />
              <input name="nextAt" type="date" defaultValue={l.nextAt ? dayKey(l.nextAt) : ""} aria-label="تابع يوم" className={inputClass} />
            </div>
            <input name="source" defaultValue={l.source} placeholder="جه منين" aria-label="جه منين" className={inputClass} />
            <textarea name="notes" defaultValue={l.notes} rows={2} placeholder="ملاحظات" aria-label="ملاحظات" className={inputClass} />
            <Button kind="secondary" small className="justify-self-start">احفظ</Button>
          </form>
          <form action={deleteLead.bind(null, l.id)} className="mt-2"><button className="text-sm text-risk">امسح</button></form>
        </details>
      </li>
    );
  };

  return (
    <>
      <PageHead title="عملاء محتملين" base="/app/leads" sub="اللي سأل ولسه ماتفقتوش: تابعه لحد ما يبقى شغل" />
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="الأرقام">
        {[
          ["مفتوحين", String(s.open)],
          ["قيمتهم", `${fmt(s.value)} ${cur.short}`],
          ["محتاجين متابعة", String(due.size)],
          ["نسبة اللي اتفقت (٩٠ يوم)", s.winRate === null ? "—" : `${s.winRate}%`],
        ].map(([k, v]) => (
          <div key={k} className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3">
            <span className="text-[0.8125rem] text-muted">{k}</span><span dir={v.includes("%") ? "ltr" : "rtl"} className="num text-right text-xl font-medium">{v}</span>
          </div>
        ))}
      </section>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {LEAD_STAGES.map((st) => {
          const list = leads.filter((l) => l.status === st.key);
          return (
            <section key={st.key} aria-label={st.label}>
              <SectionHead title={st.label} count={list.length} rule={st.key === "new" ? "cyan" : "ink"} />
              {list.length ? <ul className="grid gap-2.5">{list.map(card)}</ul> : <Empty>مفيش.</Empty>}
            </section>
          );
        })}
      </div>
      <Card className="p-5">
        <h2 className="mb-3 text-lg font-bold">حد سأل؟ سجّله</h2>
        <form action={addLead} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="الاسم"><input name="name" required placeholder="كافيه نون" className={inputClass} /></Field>
          <Field label="موبايل أو إيميل"><input name="contact" dir="ltr" className={`${inputClass} text-left`} /></Field>
          <Field label="جه منين"><input name="source" placeholder="إنستجرام، Behance، صاحبي…" className={inputClass} /></Field>
          <Field label="عايز إيه"><input name="need" placeholder="لوجو + منيو" className={inputClass} /></Field>
          <Field label={`الميزانية (${cur.short})`}><input name="budget" inputMode="decimal" className={`${inputClass} num text-left`} /></Field>
          <Field label="أتابع معاه يوم"><input name="nextAt" type="date" className={inputClass} /></Field>
          <Button className="justify-self-start">ضيف</Button>
        </form>
      </Card>
      {closed.length > 0 && (
        <Card className="p-5">
          <details open={!!sp.closed}>
            <summary className="cursor-pointer text-lg font-bold">اتقفلوا ({closed.length})</summary>
            <ul className="mt-2">
              {closed.map((l) => (
                <li key={l.id} className="flex flex-wrap items-center gap-2 border-b border-rule py-2 text-sm last:border-b-0">
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{l.name}{l.need ? <span className="text-muted"> · {l.need}</span> : null}</span>
                  {l.status === "won" ? <Pill tone="money">اتفقنا</Pill> : <Pill>مانفعش</Pill>}
                  {l.taskId && <Link href={`/app/tasks/${l.taskId}`} className="text-cyan">المهمة</Link>}
                  {l.status === "lost" && <form action={setLeadStatus.bind(null, l.id, "waiting")}><button className="text-xs text-muted hover:text-ink">رجّعه</button></form>}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}
    </>
  );
}
