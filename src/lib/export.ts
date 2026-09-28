import { dayKey } from "./dates";
import { taskDue } from "./invoice";
import type { Sheet } from "./xlsx";
import { categoryLabel } from "./categories";

type T = { title: string; client: string; status: string; priority: string; due: Date | null; doneAt: Date | null; agreed: number | null; paid: number | null; notes: string; createdAt: Date; currency?: string | null };
type E = { kind: string; name: string; client: string; amount: number; date: Date | null; startMonth: string | null; endMonth: string | null; origAmount?: number | null; origCurrency?: string | null; category?: string | null };

const STATUS: Record<string, string> = { todo: "لسه", doing: "شغال", done: "خلصت" };
const PRIORITY: Record<string, string> = { high: "مستعجل", normal: "عادي", low: "مش مستعجل" };
const day = (d: Date | null) => (d ? dayKey(d) : "");

/** The user's whole notebook as three sheets: tasks, income/expenses, subscriptions. */
export function exportSheets(tasks: T[], entries: E[], currency: string): Sheet[] {
  const money = entries.filter((e) => e.kind !== "subscription").sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
  const subs = entries.filter((e) => e.kind === "subscription");
  return [
    {
      name: "الشغل",
      rows: [
        ["المهمة", "العميل", "الحالة", "الأولوية", "الميعاد", "خلصت يوم", `المتفق عليه (${currency})`, `اتدفع (${currency})`, `الباقي (${currency})`, "ملاحظات", "اتسجلت يوم", "العملة لو مختلفة"],
        ...tasks.map((t) => [t.title, t.client, STATUS[t.status] ?? t.status, PRIORITY[t.priority] ?? t.priority, day(t.due), day(t.doneAt),
          t.agreed ?? null, t.paid ?? null, t.agreed ? Math.max(0, taskDue(t) - (t.paid ?? 0)) : null, t.notes, day(t.createdAt), t.currency ?? ""]),
      ],
    },
    {
      name: "الدخل والمصاريف",
      rows: [
        ["النوع", "عن إيه", "العميل", `المبلغ (${currency})`, "التاريخ", "المبلغ الأصلي", "التصنيف"],
        ...money.map((e) => [e.kind === "income" ? "دخل" : "مصروف", e.name, e.client, e.kind === "income" ? e.amount : -e.amount, day(e.date), e.origAmount && e.origCurrency ? `${e.origAmount} ${e.origCurrency}` : "", e.kind === "income" ? "" : categoryLabel(e.category)]),
      ],
    },
    {
      name: "الاشتراكات",
      rows: [
        ["الاشتراك", `في الشهر (${currency})`, "من شهر", "لحد شهر", "الحالة"],
        ...subs.map((e) => [e.name, e.amount, e.startMonth ?? "", e.endMonth ?? "", e.endMonth ? "متوقف" : "شغال"]),
      ],
    },
  ];
}
