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
