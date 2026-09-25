import { requireUser } from "@/lib/auth";
import { MoneyStrip } from "@/components/money-strip";
import { PageHead } from "@/components/month";
import { Button, Card, Empty, inputClass } from "@/components/ui";
import { loadMonth, monthFrom, type SP } from "@/lib/data";
import { monthTotals, fmt } from "@/lib/money";
import { dayKey, shiftMonth, AR_MONTHS, shortDate, now } from "@/lib/dates";
import { addEntry, deleteEntry, stopSubscription } from "../actions";

export const metadata = { title: "الفلوس" };

export default async function Money({ searchParams }: { searchParams: SP }) {
  const uid = await requireUser();
  const month = await monthFrom(searchParams);
  const { entries, totals: t, cur } = await loadMonth(month, uid);
  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(month, i - 5)).map((k) => ({ k, ...monthTotals(entries, k) }));
  const max = Math.max(1, ...months.map((m) => Math.max(m.I, m.out)));
  const [y, mm] = month.split("-").map(Number);
  const t0 = now();
  const defaultDate = dayKey(t0).startsWith(month) ? dayKey(t0) : dayKey(new Date(y, mm - 1, 1));

  const row = (id: string, who: string, sub: string, amt: number, sign: "+" | "−", extra?: React.ReactNode) => (
    <li key={id} className="flex items-center gap-3 border-b border-rule py-3 last:border-b-0">
      <div className="min-w-0 flex-1"><div className="font-medium [overflow-wrap:anywhere]">{who}</div><div className="text-xs text-muted">{sub}</div></div>
      <span className={`num ${sign === "+" ? "text-money" : "text-risk"}`}>{sign}{fmt(amt)}</span>
      {extra}
      <form action={deleteEntry.bind(null, id)}><button className="px-1 text-muted hover:text-risk" aria-label="امسح">✕</button></form>
    </li>
  );
  const head = (title: string, total: number) => (
    <div className="flex items-baseline justify-between border-b-2 border-ink pb-2"><h2 className="text-lg font-bold">{title}</h2><span className="num text-muted">{fmt(total)}</span></div>
  );

  return (
    <>
      <PageHead title="الفلوس" base="/app/money" month={month} sub={`كل المبالغ بالـ${cur.short}`} />
      <MoneyStrip I={t.I} S={t.S} X={t.X} net={t.net} cur={cur.short} />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-5">
          {head("الدخل", t.I)}
          {t.income.length ? <ul>{t.income.map((e) => row(e.id, e.client ? `${e.name} · ${e.client}` : e.name, e.date ? shortDate(e.date) : "", e.amount, "+"))}</ul> : <div className="py-3"><Empty>مفيش دخل في الشهر ده.</Empty></div>}
          <form action={addEntry} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <input type="hidden" name="kind" value="income" />
            <input name="name" required placeholder="عن إيه" className={inputClass} aria-label="عن إيه" />
            <input name="client" placeholder="من مين" className={inputClass} aria-label="من مين" />
            <input name="amount" required inputMode="decimal" placeholder="المبلغ" className={`${inputClass} num text-left`} aria-label="المبلغ" />
            <input name="date" type="date" defaultValue={defaultDate} className={inputClass} aria-label="التاريخ" />
            <Button small>ضيف</Button>
          </form>
        </Card>
        <Card className="grid gap-6 p-5">
          <div>
            {head("الاشتراكات الشهرية", t.S)}
            {t.subs.length ? <ul>{t.subs.map((e) => row(e.id, e.name, "كل شهر", e.amount, "−",
              <form action={stopSubscription.bind(null, e.id, shiftMonth(month, -1))}><button className="text-xs text-muted hover:text-ink">وقّفته</button></form>))}</ul>
              : <div className="py-3"><Empty>مفيش اشتراكات شغالة.</Empty></div>}
            <form action={addEntry} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
              <input type="hidden" name="kind" value="subscription" /><input type="hidden" name="month" value={month} />
              <input name="name" required placeholder="Adobe, Figma, Envato…" className={inputClass} aria-label="اسم الاشتراك" />
              <input name="amount" required inputMode="decimal" placeholder="في الشهر" className={`${inputClass} num text-left`} aria-label="المبلغ الشهري" />
              <Button small>ضيف</Button>
            </form>
          </div>
          <div>
            {head("مصاريف تانية", t.X)}
            {t.expenses.length ? <ul>{t.expenses.map((e) => row(e.id, e.name, e.date ? shortDate(e.date) : "", e.amount, "−"))}</ul> : <div className="py-3"><Empty>مفيش مصاريف.</Empty></div>}
            <form action={addEntry} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <input type="hidden" name="kind" value="expense" />
              <input name="name" required placeholder="خطوط، ستوك، طباعة…" className={inputClass} aria-label="المصروف" />
              <input name="amount" required inputMode="decimal" placeholder="المبلغ" className={`${inputClass} num text-left`} aria-label="المبلغ" />
              <input name="date" type="date" defaultValue={defaultDate} className={inputClass} aria-label="التاريخ" />
              <Button small>ضيف</Button>
            </form>
          </div>
        </Card>
      </div>
      <Card className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">آخر ٦ شهور</h2>
          <div className="flex gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-money" />دخل</span>
            <span className="flex items-center gap-1.5"><i className="size-2.5 rounded-sm bg-risk-soft" />صرف</span>
          </div>
        </div>
        <div className="flex h-56 items-end gap-2 border-b border-rule" role="img" aria-label="الدخل والصرف لآخر ست شهور">
          {months.map((m) => (
            <div key={m.k} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className={`num text-[11px] ${m.net < 0 ? "text-risk" : "text-money"}`}>{fmt(m.net)}</span>
              <div className="flex w-full items-end justify-center gap-1" style={{ height: "80%" }}>
                <i className="block w-1/3 max-w-6 rounded-t bg-money" style={{ height: `${(m.I / max) * 100}%` }} />
                <i className="block w-1/3 max-w-6 rounded-t bg-risk-soft" style={{ height: `${(m.out / max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">{months.map((m) => <span key={m.k} className={`flex-1 text-center text-xs ${m.k === month ? "font-semibold text-ink" : "text-muted"}`}>{AR_MONTHS[Number(m.k.slice(5)) - 1]}</span>)}</div>
      </Card>
    </>
  );
}
