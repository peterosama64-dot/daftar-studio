import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

const users = vi.hoisted(() => new Map<string, { id: string; weeklyEmail: boolean; lastWeekly: string | null }>());
vi.mock("../src/lib/db", () => ({
  prisma: {
    user: {
      findMany: async ({ where }: any) => where.weeklyEmail
        ? [...users.values()].filter((u) => u.weeklyEmail && u.lastWeekly !== where.OR[1].lastWeekly.not).map((u) => ({ id: u.id }))
        : [],
      updateMany: async ({ where, data }: any) => {
        const u = users.get(where.id);
        if (!u || u.lastWeekly === where.OR[1].lastWeekly.not) return { count: 0 };
        u.lastWeekly = data.lastWeekly; return { count: 1 };
      },
    },
    recurringJob: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
  },
}));
const sendMail = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
vi.mock("../src/lib/mail", () => ({ mailConfigured: () => true, sendMail }));
vi.mock("../src/lib/weekly-data", () => ({
  weeklyFor: async (id: string) => ({ to: `${id}@x.com`, data: { name: "", cur: "ج.م", appUrl: "https://x", done: [{ title: "لوجو", client: "" }], income: 100, spent: 0, upcoming: [], duePayments: [], owed: 0, followUps: 0 } }),
}));

import { GET as cron } from "../src/app/api/cron/reminders/route";

describe("weekly email in the daily job", () => {
  beforeEach(() => {
    sendMail.mockClear(); users.clear();
    users.set("a", { id: "a", weeklyEmail: true, lastWeekly: null });
    users.set("b", { id: "b", weeklyEmail: false, lastWeekly: null });
    vi.useFakeTimers();
  });
  it("sends on Friday to those who turned it on, once", async () => {
    vi.setSystemTime(new Date("2026-10-02T07:00:00Z")); // Friday in Cairo
    const r1 = await (await cron(new Request("http://x/api/cron/reminders"))).json();
    const r2 = await (await cron(new Request("http://x/api/cron/reminders"))).json();
    expect(r1.weekly).toBe(1);
    expect(r2.weekly).toBe(0);
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect((sendMail.mock.calls[0] as any)[0].to).toBe("a@x.com");
    vi.useRealTimers();
  });
  it("does nothing on other days", async () => {
    vi.setSystemTime(new Date("2026-10-03T07:00:00Z")); // Saturday
    const r = await (await cron(new Request("http://x/api/cron/reminders"))).json();
    expect(r.weekly).toBe(0);
    expect(sendMail).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
