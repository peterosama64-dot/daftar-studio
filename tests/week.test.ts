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
