import { describe, expect, it } from "vitest";
import { answerAsk, clientMatches, periodLabel, periodOf, type AskData, type AskSpec } from "../src/lib/ask";

const today = new Date(2026, 8, 27, 15, 0);
const base: AskSpec = { topic: "income", client: "", category: "", from: "", to: "", groupBy: "none", status: "any", reply: "" };
const q = (o: Partial<AskSpec>) => ({ ...base, ...o });
const E = (kind: string, name: string, client: string, amount: number, date: Date | null, extra = {}) =>
  ({ kind, name, client, amount, date, startMonth: null, endMonth: null, category: null, ...extra });
const T = (o: Partial<AskData["tasks"][number]>) => ({ id: "t", title: "x", client: "", agreed: null, paid: null, currency: null, status: "todo", due: null, doneAt: null, timeSpent: 0, timerStart: null, ...o });
const data: AskData = {
  entries: [
    E("income", "دفعة", "كافيه نون", 6000, new Date(2026, 8, 5)),
    E("income", "دفعة", "كافيه نون", 4000, new Date(2026, 1, 10)),
    E("income", "دفعة", "سكر", 3000, new Date(2026, 7, 1)),
    E("income", "دفعة", "كافيه نون", 9999, new Date(2025, 5, 1)),
    E("expense", "طباعة", "", 500, new Date(2026, 7, 20), { category: "print" }),
    E("expense", "أوبر", "", 200, new Date(2026, 8, 2), { category: "transport" }),
    E("subscription", "Adobe", "", 1000, null, { startMonth: "2026-07", category: "software" }),
  ],
  tasks: [
    T({ id: "a", title: "لوجو", client: "كافيه نون", agreed: 5000, paid: 2000, status: "done", doneAt: new Date(2026, 8, 1), timeSpent: 7200 }),
    T({ id: "b", title: "منيو", client: "سكر", agreed: 1500, paid: 0, due: new Date(2026, 8, 20) }),
    T({ id: "c", title: "بوستر", client: "سكر", due: new Date(2026, 9, 5), timeSpent: 1800 }),
  ],
  meetings: [{ title: "مكالمة", client: "كافيه نون", at: new Date(2026, 8, 28, 14, 30) }, { title: "بعيد", client: "", at: new Date(2026, 10, 1, 10, 0) }],
  leads: [{ name: "زيتون", need: "هوية", status: "new", nextAt: new Date(2026, 8, 29) }, { name: "قديم", need: "", status: "lost", nextAt: null }],
  clients: ["كافيه نون", "سكر"],
};

describe("ask: matching and periods", () => {
  it("matches client names loosely", () => {
    expect(clientMatches("كافيه نون", "نون")).toBe(true);
    expect(clientMatches("مكتبة الكرمة", "الكرمه")).toBe(true);
    expect(clientMatches("سكر", "نون")).toBe(false);
    expect(clientMatches("أي حد", "")).toBe(true);
  });
  it("names periods the way people say them", () => {
    expect(periodLabel(periodOf({ from: "2026-01-01", to: "2026-09-27" }), today)).toBe("السنة دي");
    expect(periodLabel(periodOf({ from: "2025-01-01", to: "2025-12-31" }), today)).toBe("سنة 2025");
    expect(periodLabel(periodOf({ from: "2026-08-01", to: "2026-08-31" }), today)).toBe("أغسطس 2026");
    expect(periodLabel(periodOf({ from: "2026-09-01", to: "2026-09-27" }), today)).toBe("الشهر ده");
    expect(periodLabel(periodOf({ from: "", to: "" }), today)).toBe("من الأول");
    expect(periodLabel(periodOf({ from: "2026-09-20", to: "2026-09-10" }), today)).toBe("من 10/9 لـ 20/9");
  });
});

describe("ask: answers come from the data", () => {
  it("income from a client this year", () => {
    const a = answerAsk(q({ client: "نون", from: "2026-01-01", to: "2026-09-27" }), data, today, "ج.م");
    expect(a.text).toBe("دخلك من نون السنة دي: 10,000 ج.م (2 دفعات).");
  });
  it("income by month and by client", () => {
    expect(answerAsk(q({ from: "2026-01-01", to: "2026-09-27", groupBy: "month" }), data, today, "ج.م").lines.map((l) => l.label))
      .toEqual(["فبراير 2026", "أغسطس 2026", "سبتمبر 2026"]);
    expect(answerAsk(q({ from: "2026-01-01", to: "2026-09-27" }), data, today, "ج.م").lines[0]).toEqual({ label: "كافيه نون", value: "10,000 ج.م" });
  });
  it("spending includes subscriptions per month, and splits by category", () => {
    const a = answerAsk(q({ topic: "spend", from: "2026-08-01", to: "2026-08-31" }), data, today, "ج.م");
    expect(a.text).toBe("صرفت أغسطس 2026: 1,500 ج.م.");
    expect(a.lines).toEqual([{ label: "برامج واشتراكات", value: "1,000 ج.م" }, { label: "طباعة وخامات", value: "500 ج.م" }]);
    expect(answerAsk(q({ topic: "spend", category: "transport" }), data, today, "ج.م").text).toBe("صرفت على «مواصلات» من الأول: 200 ج.م.");
  });
  it("net profit", () => {
    const a = answerAsk(q({ topic: "net", from: "2026-09-01", to: "2026-09-27" }), data, today, "ج.م");
    expect(a.text).toBe("صافي ربحك الشهر ده: 4,800 ج.م.");
  });
  it("who owes money", () => {
    const a = answerAsk(q({ topic: "owed" }), data, today, "ج.م");
    expect(a.text).toBe("لسه ليك 4,500 ج.م عند 2 عملاء.");
    expect(answerAsk(q({ topic: "owed", client: "نون" }), data, today, "ج.م").lines[0]).toMatchObject({ label: "لوجو", value: "3,000 ج.م", href: "/app/tasks/a" });
  });
  it("late and open tasks", () => {
    expect(answerAsk(q({ topic: "tasks", status: "late" }), data, today, "ج.م").text).toBe("متأخر عليك مهمة واحدة.");
    expect(answerAsk(q({ topic: "tasks", status: "open", client: "سكر" }), data, today, "ج.م").text).toBe("لسه عندك 2 مهام لـ سكر.");
  });
  it("hours and what an hour earned", () => {
    expect(answerAsk(q({ topic: "hours", client: "نون" }), data, today, "ج.م").text).toBe("اشتغلت 2 ساعة على نون، يعني الساعة جابت حوالي 2,500 ج.م.");
  });
  it("best client, meetings, leads, help", () => {
    expect(answerAsk(q({ topic: "clients", from: "2026-01-01", to: "2026-09-27" }), data, today, "ج.م").text).toBe("أكتر عميل جاب فلوس السنة دي: كافيه نون (10,000 ج.م).");
    const m = answerAsk(q({ topic: "meetings" }), data, today, "ج.م");
    expect(m.text).toBe("عندك ميعاد واحد الأيام الجاية.");
    expect(m.lines[0].value).toBe("الاتنين 28/9 2:30 م");
    expect(answerAsk(q({ topic: "leads" }), data, today, "ج.م").text).toBe("عندك عميل محتمل واحد لسه ماتقفلوش.");
    expect(answerAsk(q({ topic: "help", reply: "" }), data, today, "ج.م").text).toContain("أقدر أجاوبك");
  });
  it("says so when there is nothing", () => {
    expect(answerAsk(q({ client: "زيتون" }), data, today, "ج.م").text).toBe("مفيش دخل متسجّل من زيتون من الأول.");
  });
});
