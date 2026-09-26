"use server";

// Every write is scoped to the signed-in user: creates set userId, and
// updates/deletes use updateMany/deleteMany with { id, userId } so a guessed
// id belonging to someone else matches nothing.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CURRENCIES, PRIORITIES, SOURCES, STATUSES } from "@/lib/constants";
import { monthKey, parseDay, isMonthKey, now } from "@/lib/dates";
import { ParsedSchema } from "@/lib/parsed";
import { parseItems, quoteNotes, quoteNumber, quoteTotal, readItems } from "@/lib/quote";

const done = () => revalidatePath("/app", "layout");
const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max);
const num = (f: FormData, k: string) => {
  const raw = String(f.get(k) ?? "").replace(/[,٬\s]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
};
const oneOf = <T extends readonly string[]>(list: T, v: string, fallback: T[number]): T[number] =>
  (list as readonly string[]).includes(v) ? (v as T[number]) : fallback;

// ---------- tasks ----------
export async function addTask(f: FormData) {
  const userId = await requireUser();
  const title = str(f, "title");
  if (!title) return;
  await prisma.task.create({
    data: {
      userId, title,
      client: str(f, "client", 80),
      due: parseDay(str(f, "due", 10)),
      priority: oneOf(PRIORITIES, str(f, "priority"), "normal"),
      source: "manual",
    },
  });
  done();
}

export async function toggleTask(id: string) {
  const userId = await requireUser();
  const t = await prisma.task.findFirst({ where: { id, userId } });
  if (!t) return;
  const nowDone = t.status !== "done";
  await prisma.task.updateMany({ where: { id, userId }, data: { status: nowDone ? "done" : "todo", doneAt: nowDone ? now() : null } });
  done();
}

export async function togglePriority(id: string) {
  const userId = await requireUser();
  const t = await prisma.task.findFirst({ where: { id, userId } });
  if (!t) return;
  await prisma.task.updateMany({ where: { id, userId }, data: { priority: t.priority === "high" ? "normal" : "high" } });
  done();
}

export async function deleteTask(id: string) {
  const userId = await requireUser();
  await prisma.task.deleteMany({ where: { id, userId } });
  done();
}

export async function deleteTaskAndReturn(id: string) {
  await deleteTask(id);
  redirect("/app/tasks");
}

export async function updateTask(id: string, f: FormData) {
  const userId = await requireUser();
  const prev = await prisma.task.findFirst({ where: { id, userId } });
  if (!prev) return;
  const status = oneOf(STATUSES, str(f, "status"), "todo");
  await prisma.task.updateMany({
    where: { id, userId },
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

/** «قبضت الباقي»: mark a task fully paid and record the remaining amount as income today. */
export async function collectRemaining(id: string) {
  const userId = await requireUser();
  const t = await prisma.task.findFirst({ where: { id, userId } });
  if (!t?.agreed) return;
  const remaining = t.agreed - (t.paid ?? 0);
  if (remaining <= 0) return;
  // Only the request that still sees the old «paid» wins, so a double tap never records the income twice.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.task.updateMany({ where: { id, userId, paid: t.paid }, data: { paid: t.agreed } });
    if (!claimed.count) return;
    await tx.entry.create({ data: { userId, kind: "income", name: t.title.slice(0, 120), client: t.client, amount: remaining, date: now() } });
  });
  done();
}

// ---------- money ----------
export async function addEntry(f: FormData) {
  const userId = await requireUser();
  const kind = str(f, "kind");
  const name = str(f, "name", 120);
  const amount = num(f, "amount");
  if (!name || amount === null || !["income", "subscription", "expense"].includes(kind)) return;
  const month = str(f, "month", 7);
  await prisma.entry.create({
    data: kind === "subscription"
      ? { userId, kind, name, amount, startMonth: isMonthKey(month) ? month : monthKey(now()) }
      : { userId, kind, name, amount, client: str(f, "client", 80), date: parseDay(str(f, "date", 10)) ?? now() },
  });
  done();
}

/** Stop billing a subscription after `lastMonth` (it still counts in that month). */
export async function stopSubscription(id: string, lastMonth: string) {
  const userId = await requireUser();
  if (!isMonthKey(lastMonth)) return;
  await prisma.entry.updateMany({ where: { id, userId, kind: "subscription" }, data: { endMonth: lastMonth } });
  done();
}

export async function deleteEntry(id: string) {
  const userId = await requireUser();
  await prisma.entry.deleteMany({ where: { id, userId } });
  done();
}

// ---------- capture ----------
/** Save what «رتّبهالي» returned, after the user reviewed it. */
export async function saveParsed(input: unknown, source: string): Promise<{ ok: boolean; count: number }> {
  const userId = await requireUser();
  const p = ParsedSchema.safeParse(input);
  if (!p.success) return { ok: false, count: 0 };
  const src = oneOf(SOURCES, source, "manual");
  const today = now();
  const { tasks, income, subscriptions, expenses } = p.data;
  await prisma.$transaction([
    ...tasks.filter((t) => t.title.trim()).map((t) =>
      prisma.task.create({
        data: {
          userId, title: t.title.slice(0, 200), client: t.client.slice(0, 80), due: parseDay(t.due), priority: t.priority,
          status: t.status, doneAt: t.status === "done" ? today : null, source: src,
        },
      })),
    ...income.filter((m) => m.amount > 0).map((m) =>
      prisma.entry.create({ data: { userId, kind: "income", name: m.name.slice(0, 120) || "دخل", client: m.client.slice(0, 80), amount: m.amount, date: parseDay(m.date) ?? today } })),
    ...expenses.filter((m) => m.amount > 0).map((m) =>
      prisma.entry.create({ data: { userId, kind: "expense", name: m.name.slice(0, 120) || "مصروف", amount: m.amount, date: parseDay(m.date) ?? today } })),
  ]);
  // Subscriptions: update the amount of an active one with the same name instead of duplicating it.
  for (const s of subscriptions.filter((x) => x.amount > 0)) {
    const existing = await prisma.entry.findFirst({ where: { userId, kind: "subscription", endMonth: null, name: s.name } });
    if (existing) await prisma.entry.updateMany({ where: { id: existing.id, userId }, data: { amount: s.amount } });
    else await prisma.entry.create({ data: { userId, kind: "subscription", name: s.name.slice(0, 120) || "اشتراك", amount: s.amount, startMonth: monthKey(today) } });
  }
  done();
  return { ok: true, count: tasks.length + income.length + subscriptions.length + expenses.length };
}

// ---------- settings ----------
export async function setCurrency(f: FormData) {
  const userId = await requireUser();
  const code = str(f, "currency", 3);
  if (!CURRENCIES.some((c) => c.code === code)) return;
  await prisma.user.update({ where: { id: userId }, data: { currency: code } });
  done();
}

/** Monthly income goal; an empty field removes it. */
export async function setGoal(f: FormData) {
  const userId = await requireUser();
  const g = num(f, "goal");
  await prisma.user.update({ where: { id: userId }, data: { incomeGoal: g && g > 0 ? g : null } });
  done();
}

/** The name shown on invoices. */
export async function setName(f: FormData) {
  const userId = await requireUser();
  await prisma.user.update({ where: { id: userId }, data: { name: str(f, "name", 80) } });
  done();
}

export async function deleteEverything(f: FormData) {
  const userId = await requireUser();
  if (str(f, "confirm") !== "امسح") return;
  await prisma.$transaction([prisma.task.deleteMany({ where: { userId } }), prisma.entry.deleteMany({ where: { userId } })]);
  done();
}

// ---------- quotes ----------
export async function createQuote(f: FormData) {
  const userId = await requireUser();
  const title = str(f, "title");
  const items = parseItems(f.getAll("item_desc"), f.getAll("item_amount"));
  if (!title || !items.length) return;
  const validDays = Math.min(365, Math.max(1, Math.round(num(f, "validDays") ?? 14)));
  const delivery = num(f, "deliveryDays");
  const q = await prisma.quote.create({
    data: { userId, title, client: str(f, "client", 80), items, validDays, deliveryDays: delivery ? Math.min(365, Math.round(delivery)) : null, notes: str(f, "notes", 2000) },
  });
  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${q.id}`);
}

/** The client said yes: make the task (agreed = quote total) once, and link it. */
export async function acceptQuote(id: string) {
  const userId = await requireUser();
  const q = await prisma.quote.findFirst({ where: { id, userId } });
  if (!q) return;
  if (q.status !== "accepted") {
    const items = readItems(q.items);
    const due = q.deliveryDays ? new Date(now().getTime() + q.deliveryDays * 86_400_000) : null;
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.quote.updateMany({ where: { id, userId, status: "draft" }, data: { status: "accepted" } });
      if (!claimed.count) return;
      const t = await tx.task.create({
        data: { userId, title: q.title, client: q.client, agreed: quoteTotal(items), due, notes: quoteNotes(quoteNumber(q), items, q.deliveryDays, q.notes) },
      });
      await tx.quote.updateMany({ where: { id, userId }, data: { taskId: t.id } });
    });
  }
  done();
  const fresh = await prisma.quote.findFirst({ where: { id, userId }, select: { taskId: true } });
  if (fresh?.taskId) redirect(`/app/tasks/${fresh.taskId}`);
}

export async function deleteQuote(id: string) {
  const userId = await requireUser();
  await prisma.quote.deleteMany({ where: { id, userId } });
  revalidatePath("/app/quotes");
  redirect("/app/quotes");
}
