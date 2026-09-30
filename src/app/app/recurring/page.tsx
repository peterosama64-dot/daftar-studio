import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { fmt } from "@/lib/money";
import { monthKey, now } from "@/lib/dates";
import { mailConfigured } from "@/lib/mail";
import { PageHead } from "@/components/month";
import { Button, Card, Empty, Field, Pill, inputClass } from "@/components/ui";
import { addRecurring, deleteRecurring, setRecurringInvoice, toggleRecurring } from "../actions";

export const metadata = { title: "شغل شهري" };

export default async function Recurring() {
  const uid = await requireUser();
  const month = monthKey(now());
  const [jobs, cur] = await Promise.all([
    prisma.recurringJob.findMany({ where: { userId: uid }, orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    currencyShort(uid),
  ]);
  // This month's task of each package, so the invoice it made can be opened from here.
  const made = await prisma.task.findMany({
    where: { userId: uid, recurringId: { in: jobs.map((j) => j.id) }, createdAt: { gte: new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)) - 1, 1) } },
    select: { id: true, recurringId: true, invoiceNo: true },
    orderBy: { createdAt: "desc" },
  });
  const thisMonth = new Map(made.map((t) => [t.recurringId!, t]));
  const monthly = jobs.filter((j) => j.active).reduce((s, j) => s + j.amount, 0);
  const mail = mailConfigured();
  return (
    <>
      <PageHead title="شغل شهري" base="/app/recurring"
        sub={monthly ? `${fmt(monthly)} ${cur.short} في الشهر من الباقات الشغالة` : "عميل على باقة شهرية؟ الدفتر يعمل مهمته بمبلغها أول كل شهر"} />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-bold">باقة جديدة</h2>
          <form action={addRecurring} className="grid gap-4">
            <Field label="الشغل"><input name="title" required placeholder="سوشيال ميديا (١٢ بوست)" className={inputClass} /></Field>
            <Field label="العميل"><input name="client" placeholder="كافيه نون" className={inputClass} /></Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`المبلغ في الشهر (${cur.short})`}><input name="amount" required inputMode="decimal" className={`${inputClass} num text-left`} /></Field>
              <Field label="ميعاد التسليم (يوم كام في الشهر)"><input name="day" inputMode="numeric" defaultValue={25} className={`${inputClass} num text-left`} /></Field>
            </div>
            <label className="flex items-start gap-2.5 rounded-xl border border-rule bg-paper p-3 text-sm">
              <input type="checkbox" name="autoInvoice" defaultChecked className="mt-0.5 size-4" />
              <span>
                <b className="font-semibold">اعمل الفاتورة كمان</b>
                <span className="block text-muted">أول ما مهمة الشهر تتعمل، فاتورتها تاخد رقمها ولينك جاهز تبعته للعميل.</span>
              </span>
            </label>
            <Field label="إيميل العميل (اختياري)"><input name="clientEmail" type="email" dir="ltr" placeholder="client@example.com" className={`${inputClass} text-left`} /></Field>
            <p className="text-[0.8125rem] text-muted">
              أول كل شهر هتلاقي مهمة جديدة باسم الشهر، بالمبلغ ده، وميعادها اليوم اللي اخترته. لو الشهر ده لسه ملوش مهمة، هتتعمل دلوقتي.
              {mail ? " ولو كتبت إيميل العميل، الفاتورة بتوصله لوحدها." : " الإيميل لسه مش مفعّل على السيرفر، فاللينك هيستناك تبعته بنفسك."}
            </p>
            <Button>ضيف الباقة</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">الباقات</h2>
          {jobs.length ? (
            <ul>
              {jobs.map((j) => {
                const t = thisMonth.get(j.id);
                return (
                  <li key={j.id} className={`border-b border-rule py-3 last:border-b-0 ${j.active ? "" : "opacity-60"}`}>
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold [overflow-wrap:anywhere]">{j.title}</div>
                        <div className="text-xs text-muted">{[j.client, `كل شهر يوم ${j.dayOfMonth}`].filter(Boolean).join(" · ")}</div>
                      </div>
                      <span className="num">{fmt(j.amount)}</span>
                      {j.autoInvoice && <Pill tone="later">بفاتورة</Pill>}
                      {j.active ? <Pill tone="money">شغالة</Pill> : <Pill>متوقفة</Pill>}
                      <form action={toggleRecurring.bind(null, j.id)}><Button kind="secondary" small>{j.active ? "وقّفها" : "رجّعها"}</Button></form>
                      <form action={deleteRecurring.bind(null, j.id)}><button className="px-1 text-muted hover:text-risk" aria-label={`امسح ${j.title}`}>✕</button></form>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8125rem] text-muted">
                      {t ? (
                        <>
                          <span>{t.invoiceNo ? <>فاتورة الشهر: <span className="num text-ink">{t.invoiceNo}</span></> : "مهمة الشهر اتعملت."}</span>
                          <Link href={`/app/tasks/${t.id}/invoice`} className="text-cyan">افتح الفاتورة ‹</Link>
                          {j.autoInvoice && j.clientEmail && <span>{j.lastInvoice === month ? "اتبعتت على" : "هتتبعت على"} <span dir="ltr">{j.clientEmail}</span></span>}
                        </>
                      ) : <span>{j.active ? "مهمة الشهر ده لسه متعملتش." : "متوقفة، فمفيش مهمة الشهر ده."}</span>}
                      <details className="basis-full">
                        <summary className="cursor-pointer hover:text-ink">ظبط الفاتورة</summary>
                        <form action={setRecurringInvoice.bind(null, j.id)} className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_auto] sm:items-center">
                          <label className="flex items-center gap-2 text-ink">
                            <input type="checkbox" name="autoInvoice" defaultChecked={j.autoInvoice} className="size-4" />
                            اعمل الفاتورة كمان
                          </label>
                          <input name="clientEmail" type="email" dir="ltr" defaultValue={j.clientEmail} placeholder="client@example.com"
                            aria-label={`إيميل عميل ${j.title}`} className={`${inputClass} text-left`} />
                          <Button kind="secondary" small>احفظ</Button>
                        </form>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <Empty>لسه مفيش باقات شهرية.</Empty>}
          <p className="mt-2 text-[0.8125rem] text-muted">المهام اللي اتعملت قبل كده بتفضل زي ما هي لو وقّفت الباقة أو مسحتها.</p>
        </Card>
      </div>
    </>
  );
}
