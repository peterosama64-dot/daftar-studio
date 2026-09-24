import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { dayKey } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { SOURCE_LABEL, type Source } from "@/lib/constants";
import { Button, Card, Field, inputClass } from "@/components/ui";
import { updateTask, deleteTaskAndReturn } from "../../actions";

export default async function TaskDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, cur] = await Promise.all([prisma.task.findUnique({ where: { id } }), currencyShort()]);
  if (!t) notFound();
  const paidPct = t.agreed ? Math.min(100, ((t.paid ?? 0) / t.agreed) * 100) : 0;
  return (
    <>
      <Link href="/app/tasks" className="text-sm text-cyan">› رجوع للشغل</Link>
      <Card className="mx-auto grid w-full max-w-2xl gap-5 p-5 lg:p-7">
        <form action={updateTask.bind(null, t.id)} className="grid gap-4">
          <Field label="المهمة"><input name="title" defaultValue={t.title} required className={inputClass} /></Field>
          <fieldset className="grid grid-cols-3 gap-1 rounded-[10px] bg-sunken p-1">
            <legend className="sr-only">الحالة</legend>
            {[["todo", "لسه"], ["doing", "شغال"], ["done", "خلصت"]].map(([v, l]) => (
              <label key={v} className="cursor-pointer">
                <input type="radio" name="status" value={v} defaultChecked={t.status === v} className="peer sr-only" />
                <span className="block rounded-lg py-2 text-center text-sm text-muted peer-checked:bg-sheet peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-cyan">{l}</span>
              </label>
            ))}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="العميل"><input name="client" defaultValue={t.client} className={inputClass} /></Field>
            <Field label="الميعاد"><input name="due" type="date" defaultValue={t.due ? dayKey(t.due) : ""} className={inputClass} /></Field>
            <Field label="الأولوية">
              <select name="priority" defaultValue={t.priority} className={inputClass}>
                <option value="high">مستعجل</option><option value="normal">عادي</option><option value="low">مش مستعجل</option>
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={`المتفق عليه (${cur.short})`}><input name="agreed" inputMode="decimal" defaultValue={t.agreed ?? ""} className={`${inputClass} num text-left`} /></Field>
            <Field label={`اتدفع منه (${cur.short})`}><input name="paid" inputMode="decimal" defaultValue={t.paid ?? ""} className={`${inputClass} num text-left`} /></Field>
          </div>
          {t.agreed ? (
            <div className="grid gap-1.5">
              <div className="flex justify-between text-sm"><span className="text-muted">اتدفع</span><span className="num text-money">{fmt(t.paid ?? 0)} / {fmt(t.agreed)}</span></div>
              <div className="h-2 overflow-hidden rounded bg-paper"><div className="h-full bg-money" style={{ width: `${paidPct}%` }} /></div>
            </div>
          ) : null}
          <Field label="ملاحظات"><textarea name="notes" defaultValue={t.notes} rows={4} className={inputClass} /></Field>
          {SOURCE_LABEL[t.source as Source] && <p className="text-[13px] text-muted">جاية {SOURCE_LABEL[t.source as Source]}</p>}
          <div className="flex items-center justify-between gap-3">
            <Button>احفظ</Button>
          </div>
        </form>
        <form action={deleteTaskAndReturn.bind(null, t.id)}>
          <button className="text-sm font-medium text-risk">امسح المهمة</button>
        </form>
      </Card>
    </>
  );
}
