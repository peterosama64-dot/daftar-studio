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

import { yearSummary } from "../src/lib/year";
describe("year report", () => {
  it("adds up months, clients, subscriptions and work", () => {
    const e = (kind: string, amount: number, date: Date | null, client = "", startMonth: string | null = null, endMonth: string | null = null, name = kind) =>
      ({ kind, name, client, amount, date, startMonth, endMonth });
    const y = yearSummary([
      e("income", 4000, new Date(2026, 0, 10), "سكر"), e("income", 3000, new Date(2026, 5, 3), "نون"), e("income", 2000, new Date(2026, 5, 20), "سكر"),
      e("income", 9999, new Date(2025, 11, 31), "قديم"), e("expense", 500, new Date(2026, 5, 4)),
      e("subscription", 900, null, "", "2025-06", null, "Adobe"), e("subscription", 300, null, "", "2026-03", "2026-05", "Envato"),
    ], [
      { status: "done", doneAt: new Date(2026, 5, 1), timeSpent: 5400 }, { status: "done", doneAt: new Date(2025, 5, 1), timeSpent: 0 }, { status: "todo", doneAt: null, timeSpent: 1800 },
    ], 2026);
    expect(y.I).toBe(9000);
    expect(y.S).toBe(900 * 12 + 300 * 3);
    expect(y.X).toBe(500);
    expect(y.months[5]).toMatchObject({ k: "2026-06", I: 5000, X: 500 });
    expect(y.clients).toEqual([["سكر", 6000], ["نون", 3000]]);
    expect(y.subs).toEqual([{ name: "Adobe", months: 12, total: 10800 }, { name: "Envato", months: 3, total: 900 }]);
    expect(y).toMatchObject({ done: 1, hours: 2, best: "2026-06", activeMonths: 2 });
    // Mid-year: months that haven't happened yet cost nothing.
    const mid = yearSummary([e("subscription", 900, null, "", "2025-06", null, "Adobe")], [], 2026, "2026-09");
    expect(mid.S).toBe(900 * 9);
    expect(mid.subs[0].months).toBe(9);
  });
});

import { currentRound, revisionState, safeName, sniffType } from "../src/lib/revisions";
describe("revisions & deliveries", () => {
  it("counts revisions against the agreed number", () => {
    expect(revisionState(1, 3)).toEqual({ used: 1, allowed: 3, left: 2, over: 0, nextIsExtra: false });
    expect(revisionState(3, 3)).toMatchObject({ left: 0, over: 0, nextIsExtra: true });
    expect(revisionState(5, 3)).toMatchObject({ over: 2, nextIsExtra: true });
    expect(revisionState(4, null)).toMatchObject({ left: null, over: 0, nextIsExtra: false });
    expect(revisionState(0, 0)).toMatchObject({ nextIsExtra: true });
    expect(currentRound(0)).toBe(1);
    expect(currentRound(2)).toBe(3);
  });
  it("recognises real images and PDFs, not renamed files", () => {
    expect(sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0]))).toBe("image/png");
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("application/pdf");
    expect(sniffType(new Uint8Array([0x4d, 0x5a, 0x90, 0]))).toBeNull(); // Windows .exe
    expect(safeName('../lo"go?.png')).toBe("..-lo-go-.png");
  });
});

import { whatsappLink } from "../src/lib/contact";
describe("client contact", () => {
  it("builds WhatsApp links for Egyptian and international numbers", () => {
    expect(whatsappLink("01012345678")).toBe("https://wa.me/201012345678");
    expect(whatsappLink("٠١٠ ١٢٣٤ ٥٦٧٨")).toBe("https://wa.me/201012345678");
    expect(whatsappLink("+966 50 123 4567")).toBe("https://wa.me/966501234567");
    expect(whatsappLink("00971501234567")).toBe("https://wa.me/971501234567");
    expect(whatsappLink("123")).toBeNull();
  });
});


import { clock, nextPhase } from "../src/lib/focus";
describe("focus mode", () => {
  it("counts down and moves work → rest → idle", () => {
    expect(clock(25 * 60_000)).toBe("25:00");
    expect(clock(61_500)).toBe("01:02");
    expect(clock(-5)).toBe("00:00");
    const w = { taskId: "t", phase: "work" as const, endsAt: 0, plan: { work: 25, rest: 5 } };
    expect(nextPhase(w, 1000)).toEqual({ ...w, phase: "rest", endsAt: 1000 + 5 * 60_000 });
    expect(nextPhase({ ...w, phase: "rest" }, 1000)).toBeNull();
  });
});

import { reminderText, whatsappMessageLink } from "@/lib/remind";
import { NO_CLIENT } from "@/lib/owed";

describe("payment reminder", () => {
  const d = { client: "كافيه نون", sender: "استوديو بيتر", cur: "ج.م", total: 3500, phone: "https://wa.me/201001234567",
    tasks: [{ title: "لوجو", remaining: 2000, path: "/s/i/abc", cur: "ج.م" }, { title: "منيو", remaining: 1500, path: "/s/i/def", cur: "ج.م" }] };
  it("lists each job with its invoice link and the total", () => {
    const t = reminderText(d, "https://x.app");
    expect(t).toContain("أهلاً يا كافيه نون");
    expect(t).toContain("• لوجو: 2,000 ج.م");
    expect(t).toContain("https://x.app/s/i/def");
    expect(t).toContain("الإجمالي: 3,500 ج.م");
    expect(t.trim().endsWith("استوديو بيتر")).toBe(true);
  });
  it("skips the total line for a single job", () => {
    expect(reminderText({ ...d, tasks: [d.tasks[0]] }, "")).not.toContain("الإجمالي");
  });
  it("encodes the message into the wa.me link, with or without a phone", () => {
    expect(whatsappMessageLink(d.phone, "أهلاً & شكراً")).toBe("https://wa.me/201001234567?text=" + encodeURIComponent("أهلاً & شكراً"));
    expect(whatsappMessageLink(null, "x")).toBe("https://wa.me/?text=x");
    expect(NO_CLIENT).toBe("من غير اسم عميل");
  });
});

import { parseAmount, readQueue } from "@/lib/offline";

describe("offline queue", () => {
  it("parses amounts typed on the phone", () => {
    expect(parseAmount("١٬٥٠٠")).toBe(1500);
    expect(parseAmount("2,000")).toBe(2000);
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("-5")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
  });
  it("reads the stored queue, dropping malformed items", () => {
    const good = { id: "0123456789abcdef-01", uid: "u1", kind: "expense", title: "طباعة", client: "", amount: 50, date: "2026-09-27" };
    expect(readQueue(JSON.stringify([good, { id: "x" }, { ...good, kind: "hack" }]))).toEqual([good]);
    expect(readQueue("not json")).toEqual([]);
    expect(readQueue(null)).toEqual([]);
    expect(readQueue('{"a":1}')).toEqual([]);
  });
});

import { PLANS, installmentSummary, splitAmount } from "@/lib/installments";

describe("installments", () => {
  it("splits a price by a plan, the last part taking the rounding", () => {
    expect(splitAmount(1000, PLANS[1].parts)).toEqual([{ label: "مقدم", amount: 300 }, { label: "نص الشغل", amount: 400 }, { label: "عند التسليم", amount: 300 }]);
    const odd = splitAmount(1001, PLANS[0].parts);
    expect(odd.reduce((s, x) => s + x.amount, 0)).toBe(1001);
  });
  it("sums planned vs paid, finds the next due and the gap", () => {
    const d = (n: number) => new Date(2026, 8, n);
    const s = installmentSummary([
      { amount: 500, due: d(1), paidAt: d(1) },
      { amount: 300, due: d(20), paidAt: null },
      { amount: 200, due: d(10), paidAt: null },
    ], 1200);
    expect(s).toMatchObject({ planned: 1000, paid: 500, gap: 200 });
    expect(s.next?.amount).toBe(200);
  });
});

import { hoursLabel, rateReport } from "@/lib/rates";

describe("hourly rate report", () => {
  const t = (id: string, client: string, agreed: number | null, hours: number) => ({ id, title: id, client, agreed, timeSpent: Math.round(hours * 3600), timerStart: null });
  it("averages per client by total money over total hours", () => {
    const r = rateReport([t("a", "نون", 1000, 2), t("b", "نون", 3000, 2), t("c", "سكر", 600, 6), t("d", "سكر", 500, 0.1), t("e", "", null, 3)]);
    expect(r.jobs).toBe(3);
    expect(r.untracked).toBe(1);
    expect(r.overall).toBeCloseTo(4600 / 10);
    expect(r.clients.map((c) => [c.name, Math.round(c.rate)])).toEqual([["نون", 1000], ["سكر", 100]]);
    expect(r.best[0].id).toBe("b");
    expect(r.worst).toEqual([]);
  });
  it("counts a running timer", () => {
    const at = new Date("2026-09-27T12:00:00Z");
    const r = rateReport([{ id: "x", title: "x", client: "", agreed: 500, timeSpent: 1800, timerStart: new Date("2026-09-27T11:30:00Z") }], at);
    expect(r.overall).toBe(500);
    expect(r.clients[0].name).toBe("من غير اسم عميل");
  });
  it("is empty without tracked jobs", () => {
    expect(rateReport([]).overall).toBeNull();
  });
  it("labels hours", () => {
    expect(hoursLabel(0.5)).toBe("30 د");
    expect(hoursLabel(3.46)).toBe("3.5 س");
  });
});

describe("hourly rate report: worst list", () => {
  const t = (id: string, rate: number) => ({ id, title: id, client: "c", agreed: rate, timeSpent: 3600, timerStart: null });
  it("never repeats a job from the best list", () => {
    const r = rateReport([100, 200, 300, 400, 500, 600, 700].map((x) => t(`j${x}`, x)));
    expect(r.best.map((j) => j.id)).toEqual(["j700", "j600", "j500", "j400", "j300"]);
    expect(r.worst.map((j) => j.id)).toEqual(["j100", "j200"]);
  });
});

import { makeFx, parseRates, pickCurrency } from "@/lib/fx";

describe("exchange rates", () => {
  it("parses only known currencies with positive rates", () => {
    expect(parseRates('{"USD": 48.5, "SAR": "12.9", "XYZ": 3, "AED": 0}')).toEqual({ USD: 48.5, SAR: 12.9 });
    expect(parseRates("garbage")).toEqual({});
  });
  it("converts into the main currency", () => {
    const fx = makeFx("EGP", { USD: 48.5 });
    expect(fx.toBase(100, "USD")).toBe(4850);
    expect(fx.toBase(100, null)).toBe(100);
    expect(fx.toBase(100, "EGP")).toBe(100);
    expect(fx.usable).toEqual(["EGP", "USD"]);
    expect(fx.missing("SAR")).toBe(true);
    expect(fx.missing("USD")).toBe(false);
    expect(fx.short("USD")).toBe("$");
    expect(fx.short(null)).toBe("ج.م");
  });
  it("only accepts usable currencies from forms", () => {
    const fx = makeFx("EGP", { USD: 48.5 });
    expect(pickCurrency(fx, "USD")).toBe("USD");
    expect(pickCurrency(fx, "SAR")).toBeNull();
    expect(pickCurrency(fx, "EGP")).toBeNull();
    expect(pickCurrency(fx, "")).toBeNull();
  });
});

import { followUpDue, leadStats } from "@/lib/leads";

describe("leads", () => {
  const today = new Date(2026, 8, 27, 15);
  const l = (status: string, nextAt: Date | null, budget: number | null = null, closedAt: Date | null = null) => ({ status, nextAt, budget, createdAt: today, closedAt });
  it("follow-ups due today or earlier, open only", () => {
    const list = [l("new", new Date(2026, 8, 27, 9)), l("waiting", new Date(2026, 8, 20)), l("new", new Date(2026, 8, 28)), l("won", new Date(2026, 8, 1)), l("quoted", null)];
    expect(followUpDue(list, today).length).toBe(2);
  });
  it("stats: open value and 90-day win rate", () => {
    const s = leadStats([l("new", null, 1000), l("quoted", null, 500), l("won", null, 0, new Date(2026, 8, 1)), l("lost", null, 0, new Date(2026, 8, 2)), l("won", null, 0, new Date(2026, 0, 1))], today);
    expect(s).toEqual({ open: 2, value: 1500, winRate: 50, closed: 2 });
  });
});

import { parseBudgets, pickCategory, spendByCategory } from "@/lib/categories";

describe("expense categories and budgets", () => {
  const e = (kind: string, amount: number, category: string | null, extra = {}) =>
    ({ kind, name: "x", client: "", amount, date: new Date(2026, 8, 10), startMonth: null, endMonth: null, category, ...extra });
  it("sums a month's spending per category with budgets", () => {
    const rows = spendByCategory([
      e("expense", 300, "print"), e("expense", 400, "print"), e("expense", 50, null),
      e("subscription", 700, "software", { date: null, startMonth: "2026-01" }),
      e("expense", 999, "print", { date: new Date(2026, 7, 1) }), e("income", 5000, null),
    ], "2026-09", { print: 500, ads: 1000 });
    expect(rows.map((r) => [r.key, r.spent, r.budget, r.over])).toEqual([
      ["print", 700, 500, true], ["software", 700, null, false], [null, 50, null, false], ["ads", 0, 1000, false],
    ]);
    expect(rows[0].pct).toBe(140);
  });
  it("parses budgets and picks categories", () => {
    expect(parseBudgets('{"print": 500, "bad": 3, "ads": -1}')).toEqual({ print: 500 });
    expect(pickCategory("print", "expense")).toBe("print");
    expect(pickCategory("hack", "expense")).toBeNull();
    expect(pickCategory("", "subscription")).toBe("software");
  });
});
