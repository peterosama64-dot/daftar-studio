import { requireUser } from "@/lib/auth";
import { MoneyStrip } from "@/components/money-strip";
import { PageHead } from "@/components/month";
import Link from "next/link";
import { Button, Card, Empty, btnClass, inputClass } from "@/components/ui";
import { prisma, userRow } from "@/lib/db";
import { NO_CLIENT, owedByClient } from "@/lib/owed";
import { loadFx } from "@/lib/data";
import { CATEGORIES, parseBudgets, spendByCategory } from "@/lib/categories";
import { CategorySelect } from "@/components/category-select";
import { RemindButton } from "@/components/remind-button";
import { ReceiptScan } from "@/components/receipt-scan";
import { aiEnabled } from "@/lib/ai";
import { loadMonth, monthFrom, type SP } from "@/lib/data";
import { monthTotals, fmt } from "@/lib/money";
import { dayKey, shiftMonth, AR_MONTHS, shortDate, now } from "@/lib/dates";
import { addEntry, collectRemaining, deleteEntry, setBudgets, setEntryCategory, stopSubscription } from "../actions";

export const metadata = { title: "الفلوس" };

export default async function Money({ searchParams }: { searchParams: SP }) {
  const uid = await requireUser();
  const month = await monthFrom(searchParams);
  const [{ entries, totals: t, cur }, fx, owedTasks, budgetRow] = await Promise.all([
    loadMonth(month, uid),
    loadFx(uid),
    prisma.task.findMany({ where: { userId: uid, agreed: { gt: 0 } }, select: { id: true, title: true, client: true, agreed: true, paid: true, discount: true, taxRate: true, currency: true } }),
    userRow(uid),
  ]);
  const budgets = parseBudgets(budgetRow?.budgets);
  const spend = spendByCategory(entries, month, budgets);
  const overs = spend.filter((r) => r.over);
  const catSelect = (e: { id: string; category: string | null; name: string }) =>
    <CategorySelect action={setEntryCategory.bind(null, e.id)} value={e.category} label={`تصنيف ${e.name}`} />;
  const catPick = (def = "") => (
    <select name="category" defaultValue={def} aria-label="التصنيف" className={inputClass}>
      <option value="">التصنيف</option>
      {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
    </select>
  );
  const owed = owedByClient(owedTasks, fx.toBase);
  // Entered in another currency: show what was typed next to the date.
  const sub = (e: { date: Date | null; origAmount: number | null; origCurrency: string | null }) =>
    [e.date ? shortDate(e.date) : "", e.origAmount && e.origCurrency ? `${fmt(e.origAmount)} ${fx.short(e.origCurrency)}` : ""].filter(Boolean).join(" · ");
  const amountIn = (label: string, placeholder = "المبلغ") => (
    <div className="flex gap-1.5">
      <input name="amount" required inputMode="decimal" placeholder={placeholder} className={`${inputClass} num min-w-0 flex-1 text-left`} aria-label={label} />
      {fx.usable.length > 1 && (
        <select name="currency" defaultValue={fx.base} aria-label={`عملة ${label}`} className={`${inputClass} w-auto px-2`}>
          {fx.usable.map((c) => <option key={c} value={c}>{fx.short(c)}</option>)}
        </select>
      )}
    </div>
  );
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
      <PageHead title="الفلوس" base="/app/money" month={month} sub={`كل المبالغ بالـ${cur.short}`}>
        <Link href="/app/invoices" className="text-sm text-cyan">سجل الفواتير ‹</Link>
      </PageHead>
      <MoneyStrip I={t.I} S={t.S} X={t.X} net={t.net} cur={cur.short} />
      {owed.total > 0 && (
        <Card className="p-5" aria-labelledby="owed-h">
          <div className="flex items-baseline justify-between border-b-2 border-wait pb-2">
            <h2 id="owed-h" className="text-lg font-bold">ليك عند العملاء</h2>
            <span className="num font-semibold text-wait">{fmt(owed.total)} {cur.short}</span>
          </div>
          <ul>
            {owed.clients.map((c) => (
              <li key={c.name} className="border-b border-rule py-3 last:border-b-0">
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="font-semibold">{c.name}</span>
                  <span className="num text-wait">{fmt(c.owed)}</span>
                </div>
                <ul className="grid gap-1.5">
                  {c.tasks.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={`/app/tasks/${x.id}`} className="min-w-0 flex-1 text-ink2 [overflow-wrap:anywhere] hover:text-cyan">{x.title}</Link>
                      <span className="num text-muted">{fmt(x.remaining)}{x.currency && x.currency !== fx.base ? ` ${fx.short(x.currency)}` : ""}</span>
                      <Link href={`/app/tasks/${x.id}/invoice`} className={btnClass("ghost", true)}>فاتورة</Link>
                      <form action={collectRemaining.bind(null, x.id)}><Button kind="secondary" small>قبضت الباقي</Button></form>
                    </li>
                  ))}
                </ul>
                {c.name !== NO_CLIENT && <div className="mt-2"><RemindButton client={c.name} /></div>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[0.8125rem] text-muted">«قبضت الباقي» بيقفل المبلغ في المهمة ويسجّله دخل النهارده. لو قبضت جزء بس، عدّل «اتدفع منه» في المهمة.</p>
        </Card>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-5">
          {head("الدخل", t.I)}
          {t.income.length ? <ul>{t.income.map((e) => row(e.id, e.client ? `${e.name} · ${e.client}` : e.name, sub(e), e.amount, "+"))}</ul> : <div className="py-3"><Empty>مفيش دخل في الشهر ده.</Empty></div>}
          <form action={addEntry} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
            <input type="hidden" name="kind" value="income" />
            <input name="name" required placeholder="عن إيه" className={inputClass} aria-label="عن إيه" />
            <input name="client" placeholder="من مين" className={inputClass} aria-label="من مين" />
            {amountIn("المبلغ")}
            <input name="date" type="date" defaultValue={defaultDate} className={inputClass} aria-label="التاريخ" />
            <Button small>ضيف</Button>
          </form>
        </Card>
        <Card className="grid gap-6 p-5">
          <div>
            {head("الاشتراكات الشهرية", t.S)}
            {t.subs.length ? <ul>{t.subs.map((e) => row(e.id, e.name, ["كل شهر", sub({ date: null, origAmount: e.origAmount, origCurrency: e.origCurrency })].filter(Boolean).join(" · "), e.amount, "−",
              <>{catSelect(e)}<form action={stopSubscription.bind(null, e.id, shiftMonth(month, -1))}><button className="text-xs text-muted hover:text-ink">وقّفته</button></form></>))}</ul>
              : <div className="py-3"><Empty>مفيش اشتراكات شغالة.</Empty></div>}
            <form action={addEntry} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto]">
              <input type="hidden" name="kind" value="subscription" /><input type="hidden" name="month" value={month} />
              <input name="name" required placeholder="Adobe, Figma, Envato…" className={inputClass} aria-label="اسم الاشتراك" />
              {amountIn("المبلغ الشهري", "في الشهر")}
              {catPick("software")}
              <Button small>ضيف</Button>
            </form>
          </div>
          <div>
            {head("مصاريف تانية", t.X)}
            {t.expenses.length ? <ul>{t.expenses.map((e) => row(e.id, e.name, sub(e), e.amount, "−", catSelect(e)))}</ul> : <div className="py-3"><Empty>مفيش مصاريف.</Empty></div>}
            <form action={addEntry} className="mt-3 grid gap-2 sm:grid-cols-[2fr_1fr_1fr_1fr_auto]">
              <input type="hidden" name="kind" value="expense" />
              <input name="name" required placeholder="خطوط، ستوك، طباعة…" className={inputClass} aria-label="المصروف" />
              {amountIn("المبلغ")}
              {catPick()}
              <input name="date" type="date" defaultValue={defaultDate} className={inputClass} aria-label="التاريخ" />
              <Button small>ضيف</Button>
            </form>
            {aiEnabled() && <ReceiptScan defaultDate={defaultDate} />}
          </div>
        </Card>
      </div>
      <Card className="p-5" aria-labelledby="spend-h">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 border-b-2 border-ink pb-2">
          <h2 id="spend-h" className="text-lg font-bold">الصرف حسب البند</h2>
          {overs.length > 0 && <span className="text-sm font-semibold text-risk">عدّيت الميزانية في {overs.map((r) => r.label).join("، ")}</span>}
        </div>
        {spend.length ? (
          <ul className="grid gap-3">
            {spend.map((r) => (
              <li key={r.key ?? "none"} className="grid gap-1">
                <div className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="min-w-0 flex-1 font-medium">{r.label}</span>
                  <span className={`num ${r.over ? "font-semibold text-risk" : ""}`}>{fmt(r.spent)}</span>
                  {r.budget !== null && <span className="num text-muted">من {fmt(r.budget)}</span>}
                </div>
                {r.budget !== null && (
                  <div className="h-2 overflow-hidden rounded bg-paper" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, r.pct ?? 0)} aria-label={`${r.label} من الميزانية`}>
                    <div className={`h-full rounded ${r.over ? "bg-risk" : (r.pct ?? 0) >= 80 ? "bg-wait" : "bg-ink2"}`} style={{ width: `${Math.min(100, r.pct ?? 0)}%` }} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : <Empty>مفيش صرف الشهر ده.</Empty>}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-cyan">حدد ميزانية شهرية لكل بند</summary>
          <form action={setBudgets} className="mt-3 grid gap-2 sm:grid-cols-2">
            {CATEGORIES.map((c) => (
              <label key={c.key} className="flex items-center gap-2">
                <span className="min-w-0 flex-1">{c.label}</span>
                <input name={`budget_${c.key}`} inputMode="decimal" defaultValue={budgets[c.key] ?? ""} placeholder="من غير حد" aria-label={`ميزانية ${c.label}`} className={`${inputClass} num w-32 text-left`} />
              </label>
            ))}
            <Button small className="justify-self-start">احفظ الميزانية</Button>
          </form>
        </details>
      </Card>
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
              <span className={`num text-[0.6875rem] ${m.net < 0 ? "text-risk" : "text-money"}`}>{fmt(m.net)}</span>
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
