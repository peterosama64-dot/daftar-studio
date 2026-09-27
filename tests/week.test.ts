import { describe, expect, it } from "vitest";
import { autoPlan, hoursLabel, planDays, planRisks, weekStart, type PlanTask } from "../src/lib/week";
import { dayKey } from "../src/lib/dates";

const T = (o: Partial<PlanTask>): PlanTask => ({ id: "x", title: "x", client: "", due: null, priority: "normal", status: "todo", planDay: null, estimate: null, ...o });
const d = (day: number) => new Date(2026, 8, day); // September 2026; the 26th is a Saturday

describe("week plan", () => {
  it("weeks start on Saturday", () => {
    expect(dayKey(weekStart(new Date(2026, 8, 30, 15)))).toBe("2026-09-26");
    expect(dayKey(weekStart(d(26)))).toBe("2026-09-26");
    expect(dayKey(weekStart(d(25)))).toBe("2026-09-19");
  });
  it("labels hours", () => {
    expect(hoursLabel(0)).toBe("0 د");
    expect(hoursLabel(45)).toBe("45 د");
    expect(hoursLabel(90)).toBe("1.5 س");
    expect(hoursLabel(360)).toBe("6 س");
  });
  it("adds up each day and flags overload (no estimate = 2h), ignoring done jobs", () => {
    const days = planDays([
      T({ id: "a", planDay: d(28), estimate: 240 }), T({ id: "b", planDay: d(28) }), T({ id: "c", planDay: d(28), status: "done", estimate: 600 }),
      T({ id: "e", planDay: d(29), estimate: 60 }),
    ], d(26), 5);
    expect(days.map((x) => x.minutes)).toEqual([0, 0, 360, 60, 0, 0, 0]);
    expect(days[2].over).toBe(true);
    expect(days[3].over).toBe(false);
  });
  it("spots deadlines at risk", () => {
    const today = d(28);
    const r = planRisks([
      T({ id: "late", title: "قديم", due: d(27) }),
      T({ id: "after", title: "لوجو", due: d(29), planDay: d(30) }),
      T({ id: "soon", title: "منيو", due: d(30) }),
      T({ id: "fine", due: d(30), planDay: d(29) }),
      T({ id: "far", due: d(3 + 30) }),
      T({ id: "done", due: d(20), status: "done" }),
    ], today);
    expect(r.map((x) => x.id)).toEqual(["late", "after", "soon"]);
    expect(r[2].text).toBe("«منيو» تسليمه بعد 2 أيام ومش متوزّع");
  });
  it("auto-plans urgent first, from today, never past the deadline, within the daily hours", () => {
    const today = d(28); // Monday
    const tasks = [
      T({ id: "later", due: d(2 + 30), estimate: 180 }),
      T({ id: "urgent", due: d(29), estimate: 240, priority: "high" }),
      T({ id: "free", estimate: 240 }),
      T({ id: "placed", planDay: d(28), estimate: 60 }),
      T({ id: "big", due: d(28), estimate: 600 }),
    ];
    const plan = autoPlan(tasks, d(26), today, 6);
    const at = (id: string) => (plan.get(id) ? dayKey(plan.get(id)!) : null);
    expect(at("placed")).toBeNull(); // already on the plan: left alone
    expect(at("big")).toBe("2026-09-28"); // too big for any day, but due today: goes on today anyway
    expect(at("urgent")).toBe("2026-09-29");
    expect(at("later")).toBe("2026-09-30");
    expect(at("free")).toBe("2026-10-01"); // no deadline: first day with 4h free (28–30 are full enough)
  });
});

import { buildIcal, fold, icalText } from "../src/lib/ical";
import { followUpText, waitingDays, waitingDigest, waitingList } from "../src/lib/waiting";

describe("calendar feed", () => {
  it("escapes and folds lines at 75 bytes without breaking Arabic letters", () => {
    expect(icalText("a,b;c\\d\nهـ")).toBe("a\\,b\;c\\\\d\\nهـ");
    const long = "SUMMARY:" + "تسليم لوجو ".repeat(20);
    const folded = fold(long);
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.split("\r\n ").join("")).toBe(long);
  });
  it("writes all-day deadlines and timed meetings in the studio's timezone", () => {
    const ics = buildIcal("دفتر", [
      { uid: "t1@x", title: "تسليم: لوجو", day: new Date(2026, 8, 30) },
      { uid: "m1@x", title: "مكالمة, نون", start: new Date(2026, 9, 1, 14, 30), minutes: 60, location: "meet.google.com/x" },
    ], "Africa/Cairo", new Date(Date.UTC(2026, 8, 27, 10)));
    expect(ics).toContain("DTSTART;VALUE=DATE:20260930\r\nDTEND;VALUE=DATE:20261001");
    expect(ics).toContain("DTSTART;TZID=Africa/Cairo:20261001T143000\r\nDTEND;TZID=Africa/Cairo:20261001T153000");
    expect(ics).toContain("SUMMARY:مكالمة\\, نون");
    expect(ics).toContain("DTSTAMP:20260927T100000Z");
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});

describe("waiting on clients", () => {
  const today = new Date(2026, 8, 28, 10);
  const item = { kind: "quote" as const, id: "q", title: "هوية", client: "زيتون", link: "/s/q/x", href: "/app/quotes/q" };
  it("counts from sending, or from the last follow-up", () => {
    expect(waitingDays({ since: new Date(2026, 8, 25, 18), nudgedAt: null }, today)).toBe(3);
    expect(waitingDays({ since: new Date(2026, 8, 20), nudgedAt: new Date(2026, 8, 27) }, today)).toBe(1);
  });
  it("mentions an item in the morning push on days 3, 7 and 14 only", () => {
    const list = waitingList([
      { ...item, since: new Date(2026, 8, 25), nudgedAt: null },
      { ...item, id: "b", client: "", title: "منيو", since: new Date(2026, 8, 24), nudgedAt: null },
      { ...item, id: "c", client: "نون", since: new Date(2026, 8, 21), nudgedAt: null },
    ], today);
    expect(list.map((w) => w.days)).toEqual([7, 4, 3]);
    expect(waitingDigest(list)).toEqual(["نون (7 أيام)", "زيتون (3 أيام)"]);
  });
  it("writes a polite follow-up with the link", () => {
    const t = followUpText({ kind: "delivery", title: "لوجو", client: "سكر" }, "https://x/s/r/abc", "بيتر");
    expect(t).toBe("أهلاً يا سكر 👋\n\nحبيت أطمن إن شغل «لوجو» وصلك تمام.\nلو في أي ملاحظات أو تعديلات قولّي، ولو كله تمام تقدر توافق عليه من هنا:\nhttps://x/s/r/abc\n\nمستني ردّك 🙏\nبيتر");
  });
});
