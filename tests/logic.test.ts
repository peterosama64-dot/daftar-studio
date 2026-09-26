import { describe, it, expect } from "vitest";
import { bucket, dueTone } from "../src/lib/tasks";
import { monthTotals, activeIn } from "../src/lib/money";
import { daysUntil, shiftMonth, parseDay } from "../src/lib/dates";
import { heuristicParse, normalizeDigits } from "../src/lib/heuristic";

const today = new Date(2026, 8, 24); // Thu 24 Sep 2026
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe("tasks", () => {
  it("done wins over everything", () => {
    expect(bucket({ status: "done", priority: "high", due: d(2026, 9, 20) }, today)).toBe("done");
  });
  it("high priority is urgent even without a date", () => {
    expect(bucket({ status: "todo", priority: "high", due: null }, today)).toBe("urgent");
  });
  it("due within 2 days or overdue is urgent", () => {
    expect(bucket({ status: "todo", priority: "normal", due: d(2026, 9, 26) }, today)).toBe("urgent");
    expect(bucket({ status: "todo", priority: "low", due: d(2026, 9, 1) }, today)).toBe("urgent");
    expect(bucket({ status: "todo", priority: "normal", due: d(2026, 9, 27) }, today)).toBe("later");
  });
  it("labels overdue and tomorrow", () => {
    expect(dueTone({ status: "todo", priority: "normal", due: d(2026, 9, 22) }, today).label).toBe("متأخرة 2 أيام");
    expect(dueTone({ status: "todo", priority: "normal", due: d(2026, 9, 25) }, today).label).toBe("بكرة");
  });
});

describe("dates", () => {
  it("counts calendar days regardless of time", () => {
    expect(daysUntil(new Date(2026, 8, 25, 0, 5), new Date(2026, 8, 24, 23, 59))).toBe(1);
  });
  it("shifts months across years", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });
  it("rejects impossible days", () => {
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("2026-09-24")?.getDate()).toBe(24);
  });
});

describe("money", () => {
  const e = (o: Partial<Parameters<typeof activeIn>[0]>) => ({ kind: "income", name: "x", client: "", amount: 0, date: null, startMonth: null, endMonth: null, ...o });
  const rows = [
    e({ kind: "income", amount: 7500, date: d(2026, 9, 22) }),
    e({ kind: "income", amount: 3000, date: d(2026, 8, 30) }),
    e({ kind: "subscription", amount: 1450, startMonth: "2026-07" }),
    e({ kind: "subscription", amount: 720, startMonth: "2026-09" }),
    e({ kind: "subscription", amount: 500, startMonth: "2026-01", endMonth: "2026-08" }),
    e({ kind: "expense", amount: 600, date: d(2026, 9, 18) }),
  ];
  it("computes net for the month", () => {
    const t = monthTotals(rows, "2026-09");
    expect([t.I, t.S, t.X, t.net]).toEqual([7500, 2170, 600, 4730]);
  });
  it("stopped subscriptions still count in their last month", () => {
    expect(monthTotals(rows, "2026-08").S).toBe(1950);
  });
  it("subscriptions don't count before they start", () => {
    expect(monthTotals(rows, "2026-06").S).toBe(500);
  });
});

describe("offline parser", () => {
  it("normalizes Arabic digits and thousands", () => {
    expect(normalizeDigits("٧٥٠٠ و 1,450")).toBe("7500 و 1450");
  });
  it("splits a voice note into task, income and subscription", () => {
    const p = heuristicParse("لازم أسلّم لوجو كافيه سُكّر الخميس ومستعجل، واستلمت ٧٥٠٠ من مكتبة الكرمة، وجددت فيجما بـ ٧٢٠", today);
    expect(p.tasks).toHaveLength(1);
    expect(p.tasks[0].priority).toBe("high");
    expect(p.tasks[0].due).toBe("2026-10-01");
    expect(p.income).toEqual([expect.objectContaining({ amount: 7500 })]);
    expect(p.income[0].client).toContain("مكتبة");
    expect(p.subscriptions).toEqual([expect.objectContaining({ amount: 720 })]);
  });
  it("finds the client after لـ and drops the leading verb", () => {
    const p = heuristicParse("ومحتاج أعمل مود بورد لعيادة بسمة آخر الشهر", today);
    expect(p.tasks[0].client).toBe("عيادة بسمة");
    expect(p.tasks[0].title.startsWith("مود بورد")).toBe(true);
    expect(p.tasks[0].due).toBe("2026-09-30");
  });
  it("does not read لازم as a client", () => {
    const p = heuristicParse("لازم أسلّم البوستر بكرة", today);
    expect(p.tasks[0].client).toBe("");
    expect(p.tasks[0].title.startsWith("البوستر")).toBe(true);
  });
  it("marks finished work as done", () => {
    const p = heuristicParse("خلصت غلاف الكتالوج", today);
    expect(p.tasks[0].status).toBe("done");
  });
  it("understands bukra and thousands", () => {
    const p = heuristicParse("محتاج أبعت البوستر بكرة. واستلمت ٥ آلاف من نون", today);
    expect(p.tasks[0].due).toBe("2026-09-25");
    expect(p.income[0].amount).toBe(5000);
  });
});

describe("heuristic parser on a WhatsApp export", () => {
  const today = new Date(2026, 8, 25);
  const chat = [
    "[9/25/26, 7:04:30 PM] You: You deleted this message",
    "[9/25/26, 7:04:46 PM] You: ‎<document omitted> IMG-20260925-WA0046.jpg",
    "[9/25/26, 8:10:02 PM] Mona Cafe: ازيك يا بيتر",
    "[9/25/26, 8:11:15 PM] Mona Cafe: عايزين بوستر للمنيو الجديد يوم الخميس ومستعجل",
    "[9/25/26, 8:12:40 PM] You: تمام",
    "[9/25/26, 9:00:00 PM] Mona Cafe: حولتلك 2000 مقدم",
    "[9/25/26, 10:19:48 PM] You: و قولي عايز تشتغل على ايه منتجات منه",
  ].join("\n");
  const p = heuristicParse(chat, today);
  it("drops timestamps, names, media and small talk", () => {
    expect(p.tasks.map((t) => t.title).join(" | ")).not.toMatch(/omitted|deleted|ازيك|تمام|PM/);
    expect(p.tasks.length).toBeLessThanOrEqual(2);
  });
  it("keeps the real request and the payment", () => {
    const poster = p.tasks.find((t) => t.title.includes("بوستر"));
    expect(poster?.priority).toBe("high");
    expect(poster?.due).toBe("2026-10-01");
    expect(poster?.client).toBe("Mona Cafe");
    expect(p.income[0]?.amount).toBe(2000);
    expect(p.income[0]?.client).toBe("Mona Cafe");
  });
  it("leaves normal (non-chat) text alone", () => {
    expect(heuristicParse("بوستر مكتبة الكرمة بكرة", today).tasks).toHaveLength(1);
  });
});

describe("heuristic parser on emails from the Gmail panel", () => {
  it("reads bodies, not header lines", () => {
    const p = heuristicParse("From: Cafe <c@x.com>\nSubject: Your receipt\nDate: Fri\n\nعايزين بوستر الخميس\n\n———\n\nFrom: Adobe\nSubject: Receipt\n\nجددت اشتراك Adobe بـ 720", new Date(2026, 8, 25));
    expect(p.tasks.map((t) => t.title)).toEqual(["عايزين بوستر"]);
    expect(p.subscriptions[0]?.amount).toBe(720);
  });
});

import { invoiceNumber, invoiceTotals, safeFileName } from "../src/lib/invoice";
describe("invoice", () => {
  it("numbers invoices by creation month and id tail", () => {
    expect(invoiceNumber({ id: "cmabc123xyz9", createdAt: new Date(2026, 8, 5) })).toBe("INV-202609-XYZ9");
  });
  it("caps paid at the total and never owes a negative", () => {
    expect(invoiceTotals(3000, 1000)).toEqual({ total: 3000, paid: 1000, remaining: 2000 });
    expect(invoiceTotals(3000, 5000)).toEqual({ total: 3000, paid: 3000, remaining: 0 });
    expect(invoiceTotals(3000, null)).toEqual({ total: 3000, paid: 0, remaining: 3000 });
  });
  it("makes safe file names", () => {
    expect(safeFileName('فاتورة-كافيه نون/فرع 2-INV:1')).toBe("فاتورة-كافيه-نون-فرع-2-INV-1");
  });
});

import { owedByClient } from "../src/lib/owed";
describe("money owed", () => {
  it("groups agreed minus paid by client, biggest first, skipping settled tasks", () => {
    const r = owedByClient([
      { id: "1", title: "لوجو", client: "سكر", agreed: 3000, paid: 1000 },
      { id: "2", title: "منيو", client: "سكر", agreed: 1500, paid: null },
      { id: "3", title: "بانر", client: "نون", agreed: 5000, paid: 1000 },
      { id: "4", title: "كارت", client: "نون", agreed: 800, paid: 800 },
      { id: "5", title: "ستوري", client: "", agreed: 400, paid: 900 },
    ]);
    expect(r.total).toBe(7500);
    expect(r.clients.map((c) => [c.name, c.owed])).toEqual([["نون", 4000], ["سكر", 3500]]);
    expect(r.clients[1].tasks.map((t) => t.title)).toEqual(["لوجو", "منيو"]);
  });
});

import { parseItems, quoteNotes, quoteNumber, quoteTotal, readItems, validUntil } from "../src/lib/quote";
describe("quotes", () => {
  it("reads line items from the form, dropping blanks and bad amounts", () => {
    const items = parseItems(["لوجو", "", "كروت", "منيو", "سوشيال"], ["3,000", "500", "٧٥٠", "abc", "0"]);
    expect(items).toEqual([{ desc: "لوجو", amount: 3000 }, { desc: "كروت", amount: 750 }]);
    expect(quoteTotal(items)).toBe(3750);
  });
  it("numbers, dates and notes", () => {
    const q = { id: "ck123abcd", createdAt: new Date(2026, 8, 26) };
    expect(quoteNumber(q)).toBe("Q-202609-ABCD");
    expect(validUntil(q.createdAt, 14).getDate()).toBe(10);
    expect(readItems([{ desc: "x", amount: 1 }, { bad: 1 }, null])).toEqual([{ desc: "x", amount: 1 }]);
    expect(quoteNotes("Q-1", [{ desc: "لوجو", amount: 3000 }], 7, "")).toBe("من عرض السعر Q-1:\n- لوجو: 3000\nمدة التسليم: 7 يوم");
  });
});

import { goalProgress } from "../src/lib/goal";
describe("income goal", () => {
  const today = new Date(2026, 8, 26); // 26 Sep: 5 days left including today
  it("says how much is left per day this month", () => {
    expect(goalProgress(10000, 15000, "2026-09", today)).toEqual({ pct: 67, left: 5000, reached: false, current: true, daysLeft: 5, perDay: 1000 });
  });
  it("reports reached, and past months without per-day advice", () => {
    expect(goalProgress(16000, 15000, "2026-09", today)).toMatchObject({ pct: 107, left: 0, reached: true, perDay: 0 });
    expect(goalProgress(9000, 15000, "2026-08", today)).toMatchObject({ reached: false, current: false, daysLeft: 0, perDay: 0, left: 6000 });
  });
});

import { monthGrid } from "../src/lib/calendar";
describe("calendar grid", () => {
  it("starts weeks on Saturday and pads with blanks", () => {
    const g = monthGrid("2026-09"); // 1 Sep 2026 is a Tuesday
    expect(g[0].slice(0, 3)).toEqual([null, null, null]);
    expect(g[0][3]!.getDate()).toBe(1);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
    expect(g.every((w) => w.length === 7)).toBe(true);
  });
  it("needs no padding when the month starts on Saturday", () => {
    expect(monthGrid("2026-08")[0][0]!.getDate()).toBe(1); // 1 Aug 2026 is a Saturday
  });
});

import { recurringDue, recurringTitle, runRecurring } from "../src/lib/recurring";
describe("monthly jobs", () => {
  it("uses the month's last day when it is shorter", () => {
    expect(recurringDue("2026-02", 31).getDate()).toBe(28);
    expect(recurringDue("2026-09", 25).getDate()).toBe(25);
    expect(recurringTitle("سوشيال", "2026-10")).toBe("سوشيال · أكتوبر 2026");
  });
  it("makes one task per job per month, even when run twice", async () => {
    const jobs = [{ id: "j1", userId: "u", title: "سوشيال", client: "نون", amount: 4000, dayOfMonth: 25, active: true, lastMonth: null as string | null }];
    const tasks: Record<string, unknown>[] = [];
    const pick = (w: any) => jobs.filter((j) => (!w.id || j.id === w.id) && (w.active === undefined || j.active === w.active) && j.lastMonth !== w.OR[1].lastMonth.not);
    const db = {
      recurringJob: {
        findMany: async ({ where }: any) => pick(where),
        updateMany: async ({ where, data }: any) => { const m = pick(where); m.forEach((j) => (j.lastMonth = data.lastMonth)); return { count: m.length }; },
      },
      task: { create: async ({ data }: any) => { tasks.push(data); return data; } },
    };
    const today = new Date(2026, 9, 1);
    expect(await runRecurring(db, today)).toBe(1);
    expect(await runRecurring(db, today)).toBe(0);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: "سوشيال · أكتوبر 2026", client: "نون", agreed: 4000, recurringId: "j1" });
    expect((tasks[0].due as Date).getDate()).toBe(25);
    expect(await runRecurring(db, new Date(2026, 10, 1))).toBe(1); // next month
  });
});

import { formatDuration, hourlyRate, trackedSeconds } from "../src/lib/timer";
describe("task timer", () => {
  it("adds a running session", () => {
    const start = new Date(2026, 8, 26, 10, 0, 0);
    expect(trackedSeconds(600, start, new Date(2026, 8, 26, 10, 30, 5))).toBe(600 + 1805);
    expect(trackedSeconds(600, null)).toBe(600);
  });
  it("formats hours and minutes", () => {
    expect(formatDuration(0)).toBe("0 د");
    expect(formatDuration(45 * 60 + 59)).toBe("45 د");
    expect(formatDuration(2 * 3600 + 5 * 60)).toBe("2 س 05 د");
  });
  it("earns per hour only with an amount and 15+ minutes", () => {
    expect(hourlyRate(3000, 2 * 3600)).toBe(1500);
    expect(hourlyRate(3000, 10 * 60)).toBeNull();
    expect(hourlyRate(null, 3600)).toBeNull();
  });
});
