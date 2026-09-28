import { prisma } from "@/lib/db";
import { taskDue } from "@/lib/invoice";
import { dayKey, daysUntil, now, shortDate } from "@/lib/dates";
import { fmt } from "@/lib/money";
import { installmentSummary } from "@/lib/installments";
import { deleteInstallment, payInstallment, saveInstallments, unpayInstallment } from "@/app/app/actions";
import { InstallmentsEditor } from "./installments-editor";
import { Button, Card, Pill } from "./ui";

/** The task's payments: deposit, middle, on delivery… each with a date, marked paid as the money comes in. */
export async function InstallmentsCard({ task, cur }: { task: { id: string; agreed: number | null; discount?: number | null; taxRate?: number | null }; cur: string }) {
  const list = await prisma.installment.findMany({ where: { taskId: task.id }, orderBy: [{ position: "asc" }, { id: "asc" }] });
  // The plan covers what the client owes in the end: the price after discount and VAT.
  const s = installmentSummary(list, task.agreed ? taskDue(task) : null);
  const today = now();
  const paidSum = list.filter((x) => x.paidAt).reduce((a, x) => a + x.amount, 0);
  const left = Math.max(0, (task.agreed ? taskDue(task) : 0) - paidSum);
  const unpaid = list.filter((x) => !x.paidAt).map((x) => ({ label: x.label, amount: String(x.amount), due: x.due ? dayKey(x.due) : "" }));
  const editor = <InstallmentsEditor key={JSON.stringify([left, unpaid])} action={saveInstallments.bind(null, task.id)} left={left} initial={unpaid} cur={cur} />;
  return (
    <Card className="mx-auto grid w-full max-w-2xl gap-3 p-5 lg:p-7" aria-label="الدفعات">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-lg font-bold">الدفعات</h2>
        {list.length > 0 && <span className="num text-sm text-money">{fmt(s.paid)} / {fmt(s.planned)} {cur}</span>}
      </div>
      {list.length === 0 ? (
        <>
          <p className="text-sm text-muted">قسّم المبلغ لدفعات (مقدم، عند التسليم…) بمواعيد، وعلّم كل دفعة لما توصلك. الدفعة اللي ميعادها جه بتظهر في تذكير الصبح.</p>
          {editor}
        </>
      ) : (
        <>
          <ul>
            {list.map((x) => {
              const late = !x.paidAt && x.due && daysUntil(x.due, today)! < 0;
              return (
                <li key={x.id} className="flex flex-wrap items-center gap-2 border-b border-rule py-2.5 last:border-b-0">
                  <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${x.paidAt ? "text-muted" : "font-medium"}`}>{x.label}</span>
                  <span className="num">{fmt(x.amount)}</span>
                  {x.paidAt ? (
                    <>
                      <Pill tone="money">اتدفعت {shortDate(x.paidAt)}</Pill>
                      {x.entryId && <form action={unpayInstallment.bind(null, x.id)}><button className="text-xs text-muted hover:text-risk">رجّعها</button></form>}
                    </>
                  ) : (
                    <>
                      {x.due && <Pill tone={late ? "urgent" : "waiting"} mono>{late ? "متأخرة · " : ""}{shortDate(x.due)}</Pill>}
                      <form action={payInstallment.bind(null, x.id)}><Button kind="secondary" small>اتدفعت</Button></form>
                      <form action={deleteInstallment.bind(null, x.id)}><button className="px-1 text-muted hover:text-risk" aria-label={`امسح «${x.label}»`}>✕</button></form>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
          {s.gap !== 0 && task.agreed ? (
            <p className="text-[0.8125rem] text-wait">مجموع الدفعات {fmt(s.planned)} والمتفق عليه {fmt(task.agreed)} — {s.gap > 0 ? `فاضل ${fmt(s.gap)} مش متقسّم` : `زيادة ${fmt(-s.gap)}`}.</p>
          ) : null}
          {unpaid.length > 0 || left > 0 ? (
            <details className="text-sm">
              <summary className="cursor-pointer text-cyan">عدّل الدفعات اللي لسه</summary>
              <div className="mt-3">{editor}</div>
            </details>
          ) : null}
        </>
      )}
    </Card>
  );
}
