/* eslint-disable @next/next/no-img-element -- delivered files come from Blob storage */
import Link from "next/link";
import { taskDue } from "@/lib/invoice";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort, loadFx } from "@/lib/data";
import { fmt } from "@/lib/money";
import { now, shortDate } from "@/lib/dates";
import { quoteTotal, readItems } from "@/lib/quote";
import { whatsappLink } from "@/lib/contact";
import { Button, Card, Empty, Field, Pill, btnClass, inputClass } from "@/components/ui";
import { saveClientInfo, sharePortal, unsharePortal } from "../../actions";
import { ShareBox } from "@/components/share-box";
import { RemindButton } from "@/components/remind-button";
import { rateReport } from "@/lib/rates";

const clientName = (raw: string) => {
  try { return decodeURIComponent(raw).slice(0, 80); } catch { return raw.slice(0, 80); }
};

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  return { title: clientName((await params).name) };
}

export default async function ClientPage({ params }: { params: Promise<{ name: string }> }) {
  const uid = await requireUser();
  const name = clientName((await params).name);
  const [tasks, income, quotes, info, files, cur, fx] = await Promise.all([
    prisma.task.findMany({ where: { userId: uid, client: name }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { subtasks: { select: { done: true } } } }),
    prisma.entry.findMany({ where: { userId: uid, kind: "income", client: name }, orderBy: { date: "desc" } }),
    prisma.quote.findMany({ where: { userId: uid, client: name }, orderBy: { createdAt: "desc" } }),
    prisma.clientInfo.findUnique({ where: { userId_name: { userId: uid, name } } }),
    prisma.delivery.findMany({ where: { userId: uid, task: { client: name }, type: { startsWith: "image/" } }, orderBy: { createdAt: "desc" }, take: 6 }),
    currencyShort(uid),
    loadFx(uid),
  ]);
  if (!tasks.length && !income.length && !quotes.length && !info) notFound();
  const year = now().getFullYear();
  const total = income.reduce((s, e) => s + e.amount, 0);
  const thisYear = income.filter((e) => e.date && e.date.getFullYear() === year).reduce((s, e) => s + e.amount, 0);
  const owed = tasks.reduce((s, t) => s + (t.agreed ? fx.toBase(Math.max(0, taskDue(t) - (t.paid ?? 0)), t.currency) : 0), 0);
  const open = tasks.filter((t) => t.status !== "done");
  const rate = rateReport(tasks.map((t) => ({ ...t, agreed: t.agreed === null ? null : fx.toBase(t.agreed, t.currency) })));
  const wa = info?.phone ? whatsappLink(info.phone) : null;
  const stat = (k: string, v: string, c = "") => (
    <div className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3"><span className="text-[0.8125rem] text-muted">{k}</span><span className={`num text-xl font-medium ${c}`}>{v}</span></div>
  );
  return (
    <>
      <Link href="/app/clients" className="text-sm text-cyan">› كل العملاء</Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-2xl font-bold lg:text-[1.75rem] [overflow-wrap:anywhere]">{name}</h1>
        <div className="flex flex-wrap gap-2">
          {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className={btnClass("secondary", true)}>واتساب</a>}
          {info?.email && <a href={`mailto:${info.email}`} className={btnClass("secondary", true)}>إيميل</a>}
        </div>
      </header>
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="أرقام العميل">
        {stat(`دخل ${year}`, fmt(thisYear), "text-money")}
        {stat("دخل من الأول", fmt(total))}
        {stat("لسه عليه", fmt(owed), owed ? "text-wait" : "")}
        {stat("شغل مفتوح", String(open.length))}
      </section>
      {rate.overall !== null && (
        <p className="text-sm text-muted">
          ساعتك مع العميل ده جابت <span className="num font-medium text-ink">{fmt(rate.overall)}</span> {cur.short} في المتوسط ({rate.jobs} شغلانة متسجّل وقتها) — <Link href="/app/report/rates" className="text-cyan">قارن بباقي العملاء</Link>
        </p>
      )}
      <div className="grid gap-2">
        <ShareBox path={info?.portalToken ? `/s/c/${info.portalToken}` : null} what="كل عروضه وفواتيره وتسليماته" make={sharePortal.bind(null, name)} revoke={unsharePortal.bind(null, name)} label="لينك ملف العميل" />
        {owed > 0 && <RemindButton client={name} />}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="grid gap-5">
          <Card className="p-5">
            <h2 className="mb-2 text-lg font-bold">الشغل</h2>
            {tasks.length ? (
              <ul>{tasks.map((t) => {
                const rem = t.agreed ? Math.max(0, taskDue(t) - (t.paid ?? 0)) : 0;
                const steps = t.subtasks.length ? `${t.subtasks.filter((x) => x.done).length}/${t.subtasks.length}` : "";
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-2 border-b border-rule py-2.5 last:border-b-0">
                    <Link href={`/app/tasks/${t.id}`} className={`min-w-0 flex-1 [overflow-wrap:anywhere] hover:text-cyan ${t.status === "done" ? "text-muted line-through" : "font-medium"}`}>{t.title}</Link>
                    {steps && <Pill mono>{steps}</Pill>}
                    {t.due && t.status !== "done" && <Pill mono>{shortDate(t.due)}</Pill>}
                    {t.agreed ? <span className="num text-sm text-muted">{fmt(t.agreed)}{fx.of(t.currency) !== fx.base ? ` ${fx.short(t.currency)}` : ""}</span> : null}
                    {rem > 0 && <Pill tone="waiting">باقي {fmt(rem)}{fx.of(t.currency) !== fx.base ? ` ${fx.short(t.currency)}` : ""}</Pill>}
                  </li>
                );
              })}</ul>
            ) : <Empty>مفيش شغل.</Empty>}
          </Card>
          <Card className="p-5">
            <h2 className="mb-2 text-lg font-bold">الفلوس اللي دخلت</h2>
            {income.length ? (
              <ul>{income.map((e) => (
                <li key={e.id} className="flex justify-between gap-3 border-b border-rule py-2 text-sm last:border-b-0">
                  <span className="min-w-0 [overflow-wrap:anywhere]">{e.name} <span className="text-xs text-muted">{e.date ? shortDate(e.date) : ""}</span></span>
                  <span className="num text-money">+{fmt(e.amount)}</span>
                </li>
              ))}</ul>
            ) : <Empty>مفيش دخل متسجّل باسمه.</Empty>}
          </Card>
        </div>
        <div className="grid gap-5">
          <Card className="p-5">
            <h2 className="mb-3 text-lg font-bold">بيانات العميل</h2>
            <form action={saveClientInfo.bind(null, name)} className="grid gap-3">
              <Field label="الموبايل / واتساب"><input name="phone" dir="ltr" defaultValue={info?.phone ?? ""} placeholder="01xxxxxxxxx" className={`${inputClass} text-left`} /></Field>
              <Field label="الإيميل"><input name="email" type="email" dir="ltr" defaultValue={info?.email ?? ""} className={`${inputClass} text-left`} /></Field>
              <Field label="ملاحظات"><textarea name="notes" rows={3} defaultValue={info?.notes ?? ""} placeholder="بيحب الألوان الهادية، بيدفع آخر الشهر…" className={inputClass} /></Field>
              <Button kind="secondary" small className="justify-self-start">احفظ</Button>
            </form>
          </Card>
          {quotes.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-2 text-lg font-bold">عروض الأسعار</h2>
              <ul>{quotes.map((q) => (
                <li key={q.id} className="border-b border-rule last:border-b-0">
                  <Link href={`/app/quotes/${q.id}`} className="flex items-center gap-2 py-2 text-sm hover:text-cyan">
                    <span className="min-w-0 flex-1 truncate">{q.title}</span>
                    <span className="num text-muted">{fmt(quoteTotal(readItems(q.items)))}</span>
                    {q.status === "accepted" ? <Pill tone="money">اتوافق</Pill> : <Pill tone="waiting">مستني</Pill>}
                  </Link>
                </li>
              ))}</ul>
            </Card>
          )}
          {files.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-2 text-lg font-bold">آخر شغل اتسلّم</h2>
              <div className="grid grid-cols-3 gap-2">
                {files.map((f) => (
                  <Link key={f.id} href={`/app/tasks/${f.taskId}`} className="block overflow-hidden rounded-lg border border-rule bg-paper">
                    <img src={f.url} alt={f.name} loading="lazy" className="aspect-square w-full object-cover" />
                  </Link>
                ))}
              </div>
            </Card>
          )}
          <p className="text-[0.8125rem] text-muted">المبالغ بالـ{cur.short}.</p>
        </div>
      </div>
    </>
  );
}
