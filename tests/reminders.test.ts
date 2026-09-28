import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

// In-memory prisma for users, tasks, push subscriptions and app settings.
const db = vi.hoisted(() => ({
  users: new Map<string, { id: string; lastDigest: string | null; lastMonthly?: string | null; incomeGoal?: number | null }>(),
  entries: [] as { userId: string; kind: string; name: string; client: string; amount: number; date: Date | null; startMonth: string | null; endMonth: string | null }[],
  tasks: [] as { userId: string; title: string; client: string; due: Date | null; status: string; agreed?: number; paid?: number }[],
  subs: [] as { id: string; userId: string; endpoint: string; p256dh: string; auth: string }[],
  settings: new Map<string, string>(),
  dues: [] as { userId: string; label: string; amount: number; due: Date; paidAt: Date | null; task: { title: string; client: string } }[],
  quotes: [] as { userId: string; id: string; title: string; client: string; shareToken: string; sharedAt: Date | null; createdAt: Date; nudgedAt: Date | null }[],
  meetings: [] as { id: string; userId: string; title: string; client: string; at: Date; place: string; remindedAt: Date | null }[],
}));
vi.mock("../src/lib/db", () => {
  const notToday = (u: { lastDigest: string | null }, key: string) => u.lastDigest === null || u.lastDigest !== key;
  return {
    prisma: {
      user: {
        // Two claims share this mock: the daily digest (lastDigest) and the monthly summary (lastMonthly).
        findMany: async ({ where }: any) => {
          if (where.autoBackup) return []; // weekly copies: covered in their own test
          const f = where.OR[1].lastDigest ? "lastDigest" : "lastMonthly";
          return [...db.users.values()].filter((u) => db.subs.some((s) => s.userId === u.id) && ((u as any)[f] ?? null) !== where.OR[1][f].not)
            .map((u) => ({ id: u.id, currency: "EGP", incomeGoal: u.incomeGoal ?? null }));
        },
        updateMany: async ({ where, data }: any) => {
          const u = db.users.get(where.id) as any;
          const f = where.OR[1].lastDigest ? "lastDigest" : "lastMonthly";
          if (!u || (u[f] ?? null) === where.OR[1][f].not) return { count: 0 };
          u[f] = data[f]; return { count: 1 };
        },
      },
      task: {
        findMany: async ({ where }: any) => where.reviewToken ? [] : where.agreed
          ? db.tasks.filter((t) => t.userId === where.userId && (t.agreed ?? 0) > where.agreed.gt).map((t, i) => ({ id: String(i), ...t }))
          : db.tasks.filter((t) => t.userId === where.userId && t.status !== "done" && t.due && t.due < where.due.lt),
      },
      lead: { findMany: async () => [] },
      quote: { findMany: async ({ where }: any) => db.quotes.filter((q) => q.userId === where.userId) },
      contract: { findMany: async () => [] },
      meeting: {
        findMany: async ({ where }: any) => db.meetings.filter((m) =>
          (where.userId ? m.userId === where.userId : db.subs.some((s) => s.userId === m.userId))
          && (!("remindedAt" in where) || m.remindedAt === null)
          && m.at >= where.at.gte && (where.at.lt ? m.at < where.at.lt : m.at <= where.at.lte)),
        updateMany: async ({ where, data }: any) => {
          const m = db.meetings.find((x) => x.id === where.id && x.remindedAt === null && x.at.getTime() === where.at.getTime());
          if (!m) return { count: 0 };
          m.remindedAt = data.remindedAt; return { count: 1 };
        },
      },
      installment: {
        findMany: async ({ where }: any) => db.dues.filter((d) => d.userId === where.userId && !d.paidAt && d.due < where.due.lt),
      },
      recurringJob: { findMany: async () => [], updateMany: async () => ({ count: 0 }) },
      entry: { findMany: async ({ where }: any) => db.entries.filter((e) => e.userId === where.userId) },
      pushSubscription: {
        findMany: async ({ where }: any) => db.subs.filter((s) => s.userId === where.userId),
        deleteMany: async ({ where }: any) => { db.subs = db.subs.filter((s) => s.id !== where.id); return { count: 1 }; },
      },
      appSetting: {
        findUnique: async ({ where }: any) => (db.settings.has(where.key) ? { key: where.key, value: db.settings.get(where.key) } : null),
        createMany: async ({ data }: any) => { if (db.settings.has(data[0].key)) return { count: 0 }; db.settings.set(data[0].key, data[0].value); return { count: 1 }; },
        update: async ({ where, data }: any) => { db.settings.set(where.key, data.value); },
      },
    },
  };
});

import { buildDigest, buildMonthly } from "../src/lib/reminders";
import { GET as cron } from "../src/app/api/cron/reminders/route";
import { GET as meetingsCron } from "../src/app/api/cron/meetings/route";
import { dayKey, now } from "../src/lib/dates";

// Record what would go to the push service. The real encryption + VAPID signing is checked
// separately with web-push's own generateRequestDetails (same code path, minus the network).
import webpush from "web-push";
const received: { endpoint: string; payload: string; headers: Record<string, string>; bytes: number }[] = [];
let status = 201;
vi.spyOn(webpush, "sendNotification").mockImplementation(async (sub: any, payload: any, opts: any) => {
  const req = webpush.generateRequestDetails(sub, payload, opts);
  received.push({ endpoint: sub.endpoint, payload: String(payload), headers: req.headers as any, bytes: (req.body as unknown as Buffer).length });
  if (status >= 400) throw Object.assign(new Error("gone"), { statusCode: status });
  return { statusCode: status, body: "", headers: {} };
});
const base = "https://push.example.test";
afterAll(() => vi.restoreAllMocks());

// A real browser-style subscription key pair so web-push can encrypt.
import { createECDH, randomBytes } from "node:crypto";
const ecdh = createECDH("prime256v1"); ecdh.generateKeys();
const p256dh = ecdh.getPublicKey().toString("base64url"), auth = randomBytes(16).toString("base64url");

const d = (offset: number) => { const t = now(); return new Date(t.getFullYear(), t.getMonth(), t.getDate() + offset); };

describe("buildDigest", () => {
  const today = new Date(2026, 8, 26);
  const day = (n: number) => new Date(2026, 8, 26 + n);
  it("groups overdue, today and tomorrow, ignores done and later", () => {
    const g = buildDigest([
      { title: "لوجو", client: "سكر", due: day(-2), status: "todo" },
      { title: "بوستر", client: "", due: day(0), status: "doing" },
      { title: "فلاير", client: "", due: day(1), status: "todo" },
      { title: "خلصان", client: "", due: day(0), status: "done" },
      { title: "بعدين", client: "", due: day(5), status: "todo" },
      { title: "من غير ميعاد", client: "", due: null, status: "todo" },
    ], today)!;
    expect(g.count).toBe(3);
    expect(g.title).toBe("عندك مهمة متأخرة");
    expect(g.body).toBe("متأخر: لوجو (سكر) · النهارده: بوستر · بكرة: فلاير");
  });
  it("is quiet when nothing is due soon", () => {
    expect(buildDigest([{ title: "x", client: "", due: day(4), status: "todo" }], today)).toBeNull();
  });
  it("titles by what matters most and keeps the body short", () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ title: `مهمة طويلة رقم ${i}`, client: "", due: day(0), status: "todo" }));
    const g = buildDigest(many, today)!;
    expect(g.title).toBe("النهارده عندك 30 مهام");
    expect(g.body.length).toBeLessThanOrEqual(220);
    expect(buildDigest([{ title: "y", client: "", due: day(1), status: "todo" }], today)!.title).toBe("بكرة عندك مهمة");
  });
  it("adds what clients owe on Sundays only, and can send it alone", () => {
    const sunday = new Date(2026, 8, 27), monday = new Date(2026, 8, 28);
    const owed = { total: 7500, clients: 2, currency: "ج.م" };
    const task = [{ title: "بوستر", client: "", due: sunday, status: "todo" }];
    expect(buildDigest(task, sunday, owed)!.body).toContain("ليك 7,500 ج.م عند 2 عملاء");
    expect(buildDigest(task, monday, owed)!.body).not.toContain("ليك");
    expect(buildDigest([], sunday, owed)).toEqual({ title: "فلوسك عند العملاء", body: "ليك 7,500 ج.م عند 2 عملاء. افتح «الفلوس» وشوف مين.", count: 0 });
    expect(buildDigest([], monday, owed)).toBeNull();
    expect(buildDigest([], sunday, { ...owed, total: 0 })).toBeNull();
  });
});

describe("buildMonthly", () => {
  it("summarises the month, handles a loss and the goal", () => {
    expect(buildMonthly("أغسطس 2026", { I: 2500, S: 3550, X: 7200, net: -8250 }, 5000, "ج.م")!.body).toBe("دخلك 2,500 ج.م، وصرفت 10,750، فخسارة 8,250 ج.م. كان فاضل 2,500 على الهدف.");
    expect(buildMonthly("سبتمبر 2026", { I: 16000, S: 0, X: 0, net: 16000 }, 15000, "ج.م")!.body).toContain("وصلت لهدف الشهر.");
    expect(buildMonthly("سبتمبر 2026", { I: 0, S: 0, X: 0, net: 0 }, null, "ج.م")).toBeNull();
  });
});

describe("daily reminder job", () => {
  beforeEach(() => {
    db.users.clear(); db.tasks = []; db.entries = []; db.subs = []; db.meetings = []; db.quotes = []; received.length = 0; status = 201;
    db.users.set("u1", { id: "u1", lastDigest: null });
    db.users.set("u2", { id: "u2", lastDigest: null });
    db.subs.push({ id: "s1", userId: "u1", endpoint: `${base}/push/one`, p256dh, auth });
    db.subs.push({ id: "s2", userId: "u2", endpoint: `${base}/push/two`, p256dh, auth });
    db.tasks.push({ userId: "u1", title: "بوستر", client: "الكرمة", due: d(0), status: "todo" });
    db.tasks.push({ userId: "u2", title: "بعدين", client: "", due: d(6), status: "todo" });
  });

  it("sends one encrypted, VAPID-signed push to users with something due, once per day", async () => {
    const r1 = await (await cron(new Request("http://x/api/cron/reminders"))).json();
    expect(r1).toMatchObject({ day: dayKey(now()), users: 2, sent: 1, quiet: 1 });
    expect(received).toHaveLength(1);
    expect(received[0].endpoint).toBe(`${base}/push/one`);
    expect(JSON.parse(received[0].payload)).toMatchObject({ title: "النهارده عندك مهمة", body: "النهارده: بوستر (الكرمة)", url: "/app/tasks" });
    expect(received[0].headers["Content-Encoding"]).toBe("aes128gcm");
    expect(String(received[0].headers.Authorization)).toMatch(/^vapid t=.+, k=.+/);
    expect(received[0].bytes).toBeGreaterThan(100);
    const r2 = await (await cron(new Request("http://x/api/cron/reminders"))).json();
    expect(r2).toMatchObject({ users: 0, sent: 0 });
    expect(received).toHaveLength(1);
  });

  it("forgets a device the push service says is gone", async () => {
    status = 410;
    await cron(new Request("http://x/api/cron/reminders"));
    expect(db.subs.map((s) => s.id)).toEqual(["s2"]);
  });

  it("adds what clients owe on Sundays only", async () => {
    db.tasks.push({ userId: "u1", title: "لوجو", client: "سكر", due: null, status: "done", agreed: 3000, paid: 1000 });
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-09-28T07:00:00Z")); // Monday in Cairo
      await cron(new Request("http://x/api/cron/reminders"));
      const u1 = () => JSON.parse(received.filter((r) => r.endpoint.endsWith("/push/one")).at(-1)!.payload).body;
      expect(u1()).not.toContain("ليك");
      vi.setSystemTime(new Date("2026-10-04T07:00:00Z")); // Sunday in Cairo; tasks now overdue
      await cron(new Request("http://x/api/cron/reminders"));
      expect(u1()).toContain("ليك 2,000 ج.م عند عميل");
    } finally { vi.useRealTimers(); }
  });

  it("sends last month's summary on the 1st, once, linking to that report", async () => {
    const e = (kind: string, amount: number, date: Date | null, startMonth: string | null = null) => ({ userId: "u1", kind, name: kind, client: "", amount, date, startMonth, endMonth: null });
    db.entries.push(e("income", 12000, new Date(2026, 8, 10)), e("expense", 500, new Date(2026, 8, 12)), e("subscription", 900, null, "2026-01"), e("income", 99999, new Date(2026, 9, 1)));
    db.users.get("u1")!.incomeGoal = 15000;
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-10-01T07:00:00Z"));
      const r = await (await cron(new Request("http://x/api/cron/reminders"))).json();
      expect(r.monthly).toBe(1); // u2 had no money last month: no summary
      const m = received.map((x) => JSON.parse(x.payload)).find((p) => p.tag === "daftar-monthly");
      expect(m).toEqual({ title: "ملخص سبتمبر 2026", body: "دخلك 12,000 ج.م، وصرفت 1,400، فصافي ربحك 10,600 ج.م (هامش 88%). كان فاضل 3,000 على الهدف.", url: "/app/report?m=2026-09", tag: "daftar-monthly" });
      const again = await (await cron(new Request("http://x/api/cron/reminders"))).json();
      expect(again.monthly).toBe(0);
      vi.setSystemTime(new Date("2026-10-02T07:00:00Z"));
      expect((await (await cron(new Request("http://x/api/cron/reminders"))).json()).monthly).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it("reminds each meeting once, about an hour before, and again only if it is moved", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-09-28T10:00:00Z")); // 13:00 in Cairo
      const at = (h: number, m: number) => new Date(2026, 8, 28, h, m);
      db.meetings.push(
        { id: "m1", userId: "u1", title: "مكالمة", client: "نون", at: at(13, 45), place: "", remindedAt: null },
        { id: "m2", userId: "u1", title: "بعدين", client: "", at: at(15, 0), place: "", remindedAt: null },
        { id: "m3", userId: "u2", title: "فاتت", client: "", at: at(12, 0), place: "", remindedAt: null },
        { id: "m4", userId: "nobody", title: "من غير تنبيهات", client: "", at: at(13, 30), place: "", remindedAt: null },
      );
      const r1 = await (await meetingsCron(new Request("http://x/api/cron/meetings"))).json();
      expect(r1).toMatchObject({ due: 1, sent: 1 });
      expect(JSON.parse(received[0].payload)).toEqual({ title: "بعد 45 دقيقة: مكالمة مع نون", body: "الساعة 1:45 م", url: "/app/meetings", tag: "daftar-meeting-m1" });
      expect((await (await meetingsCron(new Request("http://x/api/cron/meetings"))).json()).sent).toBe(0);
      vi.setSystemTime(new Date("2026-09-28T11:05:00Z")); // 14:05: m2 comes into range
      expect((await (await meetingsCron(new Request("http://x/api/cron/meetings"))).json()).sent).toBe(1);
      expect(received).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it("puts today's meetings in the morning push", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-09-28T06:00:00Z")); // 9:00 in Cairo
      db.meetings.push({ id: "m9", userId: "u2", title: "اجتماع", client: "سكر", at: new Date(2026, 8, 28, 16, 0), place: "", remindedAt: null });
      await cron(new Request("http://x/api/cron/reminders"));
      const u2 = received.find((r) => r.endpoint.endsWith("/push/two"))!;
      expect(JSON.parse(u2.payload)).toMatchObject({ title: "النهارده عندك ميعاد", body: "مواعيدك: 4:00 م اجتماع (سكر)" });
    } finally { vi.useRealTimers(); }
  });

  it("mentions a quote the client hasn't answered on day 3 only", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-09-28T06:00:00Z"));
      db.tasks = [];
      db.quotes.push({ userId: "u2", id: "q1", title: "هوية", client: "زيتون", shareToken: "tok", sharedAt: new Date(2026, 8, 25, 12), createdAt: new Date(2026, 8, 20), nudgedAt: null });
      await cron(new Request("http://x/api/cron/reminders"));
      expect(received.map((r) => JSON.parse(r.payload))).toEqual([expect.objectContaining({ title: "في عميل مارّدش عليك", body: "مستني رد: زيتون (3 أيام)" })]);
      vi.setSystemTime(new Date("2026-09-29T06:00:00Z"));
      await cron(new Request("http://x/api/cron/reminders"));
      expect(received).toHaveLength(1);
    } finally { vi.useRealTimers(); }
  });

  it("requires CRON_SECRET when it is set", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(new Request("http://x/api/cron/reminders"))).status).toBe(401);
    expect((await cron(new Request("http://x/api/cron/reminders", { headers: { authorization: "Bearer s3cret" } }))).status).toBe(200);
    expect((await meetingsCron(new Request("http://x/api/cron/meetings"))).status).toBe(401);
    expect((await meetingsCron(new Request("http://x/api/cron/meetings", { headers: { authorization: "Bearer s3cret" } }))).status).toBe(200);
    delete process.env.CRON_SECRET;
  });
});

describe("digest with due payments", () => {
  const today = new Date(2026, 8, 23); // a Wednesday
  it("lists due payments with the tasks", () => {
    const d = buildDigest([{ title: "لوجو", client: "", due: today, status: "todo" }], today, undefined,
      [{ label: "مقدم", title: "منيو", client: "سكر", amount: 1500 }])!;
    expect(d.title).toBe("النهارده عندك مهمة");
    expect(d.body).toContain("دفعات مستحقة: مقدم منيو (سكر) 1,500");
  });
  it("speaks even when only a payment is due", () => {
    const d = buildDigest([], today, undefined, [{ label: "مقدم", title: "منيو", client: "", amount: 500 }, { label: "الباقي", title: "لوجو", client: "", amount: 700 }])!;
    expect(d.title).toBe("عندك 2 دفعات مستحقة");
    expect(d.body).toContain("مقدم منيو 500");
  });
  it("stays quiet with nothing due", () => {
    expect(buildDigest([], today, undefined, [])).toBeNull();
  });
});

describe("digest with lead follow-ups", () => {
  const today = new Date(2026, 8, 23);
  it("speaks when only follow-ups are due", () => {
    const d = buildDigest([], today, undefined, [], ["كافيه نون", "سكر"])!;
    expect(d.title).toBe("عندك 2 عملاء محتاجين متابعة");
    expect(d.body).toContain("تابع مع: كافيه نون، سكر");
  });
  it("adds them to a normal digest", () => {
    const d = buildDigest([{ title: "لوجو", client: "", due: today, status: "todo" }], today, undefined, [], ["نون"])!;
    expect(d.body).toContain("تابع مع: نون");
  });
});

import { meetingReminder, placeLink, reminderWindow } from "../src/lib/meetings";
import { clock, parseDayTime } from "../src/lib/dates";

describe("meetings", () => {
  const now = new Date(2026, 8, 28, 13, 30);
  it("formats the clock the way people say it", () => {
    expect(clock(new Date(2026, 8, 28, 14, 5))).toBe("2:05 م");
    expect(clock(new Date(2026, 8, 28, 0, 0))).toBe("12:00 ص");
    expect(clock(new Date(2026, 8, 28, 12, 30))).toBe("12:30 م");
  });
  it("parses a day and a time, rejecting nonsense", () => {
    expect(parseDayTime("2026-09-28", "14:30")).toEqual(new Date(2026, 8, 28, 14, 30));
    expect(parseDayTime("2026-09-28", "25:00")).toBeNull();
    expect(parseDayTime("2026-02-30", "10:00")).toBeNull();
    expect(parseDayTime("2026-09-28", "")).toBeNull();
  });
  it("reminds within the hour before, and not long after the start", () => {
    const w = reminderWindow(now);
    expect(w.lte).toEqual(new Date(2026, 8, 28, 14, 30));
    expect(w.gte).toEqual(new Date(2026, 8, 28, 13, 25));
  });
  it("says how long is left", () => {
    const m = { title: "مكالمة", client: "نون", at: new Date(2026, 8, 28, 14, 30), place: "meet.google.com/abc" };
    expect(meetingReminder(m, now)).toEqual({ title: "بعد ساعة: مكالمة مع نون", body: "الساعة 2:30 م · meet.google.com/abc" });
    expect(meetingReminder({ ...m, at: new Date(2026, 8, 28, 13, 50) }, now).title).toBe("بعد 20 دقيقة: مكالمة مع نون");
    expect(meetingReminder({ ...m, title: "اجتماع نون", at: new Date(2026, 8, 28, 13, 35) }, now).title).toBe("بعد 5 دقايق: اجتماع نون");
    expect(meetingReminder({ ...m, at: now }, now).title).toBe("دلوقتي: مكالمة مع نون");
  });
  it("turns meeting links into links, and leaves addresses alone", () => {
    expect(placeLink("meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(placeLink("https://us02web.zoom.us/j/123")).toBe("https://us02web.zoom.us/j/123");
    expect(placeLink("javascript:alert(1)")).toBeNull();
    expect(placeLink("المعادي، شارع 9")).toBeNull();
  });
  it("puts today's meetings in the morning digest", () => {
    const today = new Date(2026, 8, 28, 9, 0);
    const g = buildDigest([], today, undefined, [], [], [{ title: "مكالمة", client: "نون", at: new Date(2026, 8, 28, 14, 30) }, { title: "اجتماع سكر", client: "سكر", at: new Date(2026, 8, 28, 17, 0) }])!;
    expect(g).toEqual({ title: "النهارده عندك 2 مواعيد", body: "مواعيدك: 2:30 م مكالمة (نون)، 5:00 م اجتماع سكر", count: 0 });
    const t = buildDigest([{ title: "لوجو", client: "", due: today, status: "todo" }], today, undefined, [], ["زيتون"], [{ title: "مكالمة", client: "", at: new Date(2026, 8, 28, 11, 0) }])!;
    expect(t.title).toBe("النهارده عندك مهمة");
    expect(t.body).toBe("النهارده: لوجو · مواعيدك: 11:00 ص مكالمة · تابع مع: زيتون");
  });
});
