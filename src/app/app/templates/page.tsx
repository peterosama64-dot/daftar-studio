import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { fmt } from "@/lib/money";
import { PageHead } from "@/components/month";
import { Button, Card, Empty, Field, Pill, inputClass } from "@/components/ui";
import { addTemplate, deleteTemplate, startFromTemplate, updateTemplate } from "../actions";

export const metadata = { title: "قوالب الشغل" };

type Tpl = { name: string; amount: number | null; days: number | null; steps: string; notes: string };

function TemplateFields({ t, cur }: { t?: Tpl; cur: string }) {
  return (
    <>
      <Field label="اسم الشغل"><input name="name" required defaultValue={t?.name} placeholder="لوجو + هوية بسيطة" className={inputClass} /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={`السعر (${cur})`}><input name="amount" inputMode="decimal" defaultValue={t?.amount ?? ""} className={`${inputClass} num text-left`} /></Field>
        <Field label="بيخلص في (يوم)"><input name="days" inputMode="numeric" defaultValue={t?.days ?? ""} placeholder="7" className={`${inputClass} num text-left`} /></Field>
      </div>
      <Field label="الخطوات (كل خطوة في سطر)"><textarea name="steps" rows={4} defaultValue={t?.steps} placeholder={"بريف مع العميل\n٣ اسكتشات\nتعديلين\nتسليم الملفات"} className={inputClass} /></Field>
      <Field label="ملاحظات"><textarea name="notes" rows={2} defaultValue={t?.notes} placeholder="بيشمل ٢ تعديل. الملفات المفتوحة بسعر إضافي." className={inputClass} /></Field>
    </>
  );
}

export default async function Templates({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const uid = await requireUser();
  const [list, cur, sp] = await Promise.all([
    prisma.taskTemplate.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" } }),
    currencyShort(uid),
    searchParams,
  ]);
  return (
    <>
      <PageHead title="قوالب الشغل" base="/app/templates" sub="الشغل اللي بيتكرر: احفظ سعره وخطواته ومدته مرة، واعمل منه مهمة بضغطة" />
      {sp.saved && <p role="status" className="rounded-xl bg-money-soft px-4 py-2 text-sm text-money">اتحفظ القالب ✓ تقدر تعدّله من تحت.</p>}
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.3fr]">
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-bold">قالب جديد</h2>
          <form action={addTemplate} className="grid gap-4">
            <TemplateFields cur={cur.short} />
            <Button>احفظ القالب</Button>
          </form>
          <p className="mt-3 text-[0.8125rem] text-muted">أو من أي مهمة: «احفظها كقالب» بياخد اسمها وسعرها وخطواتها.</p>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">القوالب</h2>
          {list.length ? (
            <ul>
              {list.map((t) => {
                const steps = t.steps ? t.steps.split("\n") : [];
                return (
                  <li key={t.id} className="grid gap-2.5 border-b border-rule py-4 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{t.name}</span>
                      {t.amount ? <span className="num">{fmt(t.amount)}</span> : null}
                      {t.days ? <Pill mono>{t.days} {t.days >= 3 && t.days <= 10 ? "أيام" : "يوم"}</Pill> : null}
                      {steps.length > 0 && <Pill mono>{steps.length} خطوات</Pill>}
                    </div>
                    <form action={startFromTemplate.bind(null, t.id)} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input name="client" placeholder="لمين؟ (العميل)" aria-label={`العميل لـ ${t.name}`} className={inputClass} />
                      <input name="title" placeholder={t.name} aria-label={`اسم المهمة من ${t.name}`} className={inputClass} />
                      <Button small>اعمل مهمة</Button>
                    </form>
                    <details className="text-sm">
                      <summary className="cursor-pointer text-cyan">عدّل</summary>
                      <form action={updateTemplate.bind(null, t.id)} className="mt-3 grid gap-4">
                        <TemplateFields t={t} cur={cur.short} />
                        <div className="flex items-center justify-between">
                          <Button kind="secondary" small>احفظ التعديل</Button>
                        </div>
                      </form>
                      <form action={deleteTemplate.bind(null, t.id)} className="mt-2"><button className="text-sm font-medium text-risk">امسح القالب</button></form>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : <Empty>لسه مفيش قوالب.</Empty>}
        </Card>
      </div>
    </>
  );
}
