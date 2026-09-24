"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { CURRENCIES, PRIORITIES, SOURCES, STATUSES } from "@/lib/constants";
import { monthKey, parseDay, isMonthKey, now } from "@/lib/dates";
import { ParsedSchema } from "@/lib/parsed";

const done = () => revalidatePath("/app", "layout");
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const num = (f: FormData, k: string) => {
  const n = Number(String(f.get(k) ?? "").replace(/[,٬\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const oneOf = <T extends readonly string[]>(list: T, v: string, fallback: T[number]): T[number] =>
  (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

// ---------- tasks ----------
export async function addTask(f: FormData) {
  const title = str(f, "title");
  if (!title) return;
  await prisma.task.create({
    data: {
      title,
      client: str(f, "client", 80),
      due: parseDay(str(f, "due", 10)),
      priority: oneOf(PRIORITIES, str(f, "priority"), "normal"),
      source: "manual",
    },
  });
  done();
}

export async function toggleTask(id: string) {
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return;
  const nowDone = t.status !== "done";
  await prisma.task.update({ where: { id }, data: { status: nowDone ? "done" : "todo", doneAt: nowDone ? now() : null } });
  done();
}

export async function togglePriority(id: string) {
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return;
  await prisma.task.update({ where: { id }, data: { priority: t.priority === "high" ? "normal" : "high" } });
  done();
}

export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } }).catch(() => null);
  done();
}

export async function deleteTaskAndReturn(id: string) {
  await prisma.task.delete({ where: { id } }).catch(() => null);
  done();
  redirect("/app/tasks");
}

export async function updateTask(id: string, f: FormData) {
  const status = oneOf(STATUSES, str(f, "status"), "todo");
  const prev = await prisma.task.findUnique({ where: { id } });
  if (!prev) return;
  await prisma.task.update({
    where: { id },
    data: {
      title: str(f, "title") || prev.title,
      client: str(f, "client", 80),
      due: parseDay(str(f, "due", 10)),
      priority: oneOf(PRIORITIES, str(f, "priority"), "normal"),
      status,
      doneAt: status === "done" ? prev.doneAt ?? now() : null,
      notes: str(f, "notes", 4000),
      agreed: num(f, "agreed"),
      paid: num(f, "paid"),
    },
  });
  done();
}

// ---------- money ----------
export async function addEntry(f: FormData) {
  const kind = str(f, "kind");
  const name = str(f, "name", 120);
  const amount = num(f, "amount");
  if (!name || amount === null || !["income", "subscription", "expense"].includes(kind)) return;
  const month = str(f, "month", 7);
  await prisma.entry.create({
    data: kind === "subscription"
      ? { kind, name, amount, startMonth: isMonthKey(month) ? month : monthKey(now()) }
      : { kind, name, amount, client: str(f, "client", 80), date: parseDay(str(f, "date", 10)) ?? now() },
  });
  done();
}

/** Stop billing a subscription from `month` onward (it still counts in the month before). */
export async function stopSubscription(id: string, lastMonth: string) {
  if (!isMonthKey(lastMonth)) return;
  await prisma.entry.update({ where: { id }, data: { endMonth: lastMonth } }).catch(() => null);
  done();
}

export async function deleteEntry(id: string) {
  await prisma.entry.delete({ where: { id } }).catch(() => null);
  done();
}

// ---------- capture ----------
/** Save what «رتّبهالي» returned, after the user reviewed it. */
export async function saveParsed(input: unknown, source: string): Promise<{ ok: boolean; count: number }> {
  const p = ParsedSchema.safeParse(input);
  if (!p.success) return { ok: false, count: 0 };
  const src = oneOf(SOURCES, source, "manual");
  const today = now();
  const { tasks, income, subscriptions, expenses } = p.data;
  await prisma.$transaction([
    ...tasks.filter((t) => t.title.trim()).map((t) =>
      prisma.task.create({
        data: {
          title: t.title.slice(0, 200), client: t.client.slice(0, 80), due: parseDay(t.due), priority: t.priority,
          status: t.status, doneAt: t.status === "done" ? today : null, source: src,
        },
      })),
    ...income.filter((m) => m.amount > 0).map((m) =>
      prisma.entry.create({ data: { kind: "income", name: m.name.slice(0, 120) || "دخل", client: m.client.slice(0, 80), amount: m.amount, date: parseDay(m.date) ?? today } })),
    ...expenses.filter((m) => m.amount > 0).map((m) =>
      prisma.entry.create({ data: { kind: "expense", name: m.name.slice(0, 120) || "مصروف", amount: m.amount, date: parseDay(m.date) ?? today } })),
  ]);
  // Subscriptions: update the amount of an active one with the same name instead of duplicating it.
  for (const s of subscriptions.filter((x) => x.amount > 0)) {
    const existing = await prisma.entry.findFirst({ where: { kind: "subscription", endMonth: null, name: s.name } });
    if (existing) await prisma.entry.update({ where: { id: existing.id }, data: { amount: s.amount } });
    else await prisma.entry.create({ data: { kind: "subscription", name: s.name.slice(0, 120) || "اشتراك", amount: s.amount, startMonth: monthKey(today) } });
  }
  done();
  return { ok: true, count: tasks.length + income.length + subscriptions.length + expenses.length };
}

// ---------- settings ----------
export async function setCurrency(f: FormData) {
  const code = str(f, "currency", 3);
  if (!CURRENCIES.some((c) => c.code === code)) return;
  await prisma.setting.upsert({ where: { key: "currency" }, update: { value: code }, create: { key: "currency", value: code } });
  done();
}

export async function deleteEverything(f: FormData) {
  if (str(f, "confirm") !== "امسح") return;
  await prisma.$transaction([prisma.task.deleteMany(), prisma.entry.deleteMany()]);
  done();
}

