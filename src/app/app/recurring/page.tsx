import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { fmt } from "@/lib/money";
import { PageHead } from "@/components/month";
import { Button, Card, Empty, Field, Pill, inputClass } from "@/components/ui";
import { addRecurring, deleteRecurring, toggleRecurring } from "../actions";

export const metadata = { title: "شغل شهري" };

export default async function Recurring() {
  const uid = await requireUser();
  const [jobs, cur] = await Promise.all([
    prisma.recurringJob.findMany({ where: { userId: uid }, orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    currencyShort(uid),
  ]);
  const monthly = jobs.filter((j) => j.active).reduce((s, j) => s + j.amount, 0);
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
            <p className="text-[0.8125rem] text-muted">أول كل شهر هتلاقي مهمة جديدة باسم الشهر، بالمبلغ ده، وميعادها اليوم اللي اخترته. لو الشهر ده لسه ملوش مهمة، هتتعمل دلوقتي.</p>
            <Button>ضيف الباقة</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">الباقات</h2>
          {jobs.length ? (
            <ul>
              {jobs.map((j) => (
                <li key={j.id} className={`flex flex-wrap items-center gap-3 border-b border-rule py-3 last:border-b-0 ${j.active ? "" : "opacity-60"}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold [overflow-wrap:anywhere]">{j.title}</div>
                    <div className="text-xs text-muted">{[j.client, `كل شهر يوم ${j.dayOfMonth}`].filter(Boolean).join(" · ")}</div>
                  </div>
                  <span className="num">{fmt(j.amount)}</span>
                  {j.active ? <Pill tone="money">شغالة</Pill> : <Pill>متوقفة</Pill>}
                  <form action={toggleRecurring.bind(null, j.id)}><Button kind="secondary" small>{j.active ? "وقّفها" : "رجّعها"}</Button></form>
                  <form action={deleteRecurring.bind(null, j.id)}><button className="px-1 text-muted hover:text-risk" aria-label={`امسح ${j.title}`}>✕</button></form>
                </li>
              ))}
            </ul>
          ) : <Empty>لسه مفيش باقات شهرية.</Empty>}
          <p className="mt-2 text-[0.8125rem] text-muted">المهام اللي اتعملت قبل كده بتفضل زي ما هي لو وقّفت الباقة أو مسحتها.</p>
        </Card>
      </div>
    </>
  );
}
