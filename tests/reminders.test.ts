import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

// In-memory prisma for users, tasks, push subscriptions and app settings.
const db = vi.hoisted(() => ({
  users: new Map<string, { id: string; lastDigest: string | null }>(),
  tasks: [] as { userId: string; title: string; client: string; due: Date | null; status: string }[],
  subs: [] as { id: string; userId: string; endpoint: string; p256dh: string; auth: string }[],
  settings: new Map<string, string>(),
}));
vi.mock("../src/lib/db", () => {
  const notToday = (u: { lastDigest: string | null }, key: string) => u.lastDigest === null || u.lastDigest !== key;
  return {
    prisma: {
      user: {
        findMany: async ({ where }: any) => [...db.users.values()].filter((u) => db.subs.some((s) => s.userId === u.id) && notToday(u, where.OR[1].lastDigest.not)).map((u) => ({ id: u.id })),
        updateMany: async ({ where, data }: any) => {
          const u = db.users.get(where.id);
          if (!u || !notToday(u, where.OR[1].lastDigest.not)) return { count: 0 };
          u.lastDigest = data.lastDigest; return { count: 1 };
        },
      },
      task: { findMany: async ({ where }: any) => db.tasks.filter((t) => t.userId === where.userId && t.status !== "done" && t.due && t.due < where.due.lt) },
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

import { buildDigest } from "../src/lib/reminders";
import { GET as cron } from "../src/app/api/cron/reminders/route";
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
});

describe("daily reminder job", () => {
  beforeEach(() => {
    db.users.clear(); db.tasks = []; db.subs = []; received.length = 0; status = 201;
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

  it("requires CRON_SECRET when it is set", async () => {
    process.env.CRON_SECRET = "s3cret";
    expect((await cron(new Request("http://x/api/cron/reminders"))).status).toBe(401);
    expect((await cron(new Request("http://x/api/cron/reminders", { headers: { authorization: "Bearer s3cret" } }))).status).toBe(200);
    delete process.env.CRON_SECRET;
  });
});
