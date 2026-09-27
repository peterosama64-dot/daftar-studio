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
import { runRecurring } from "@/lib/recurring";
import { parseItems } from "@/lib/quote";
import { acceptQuoteFor, newToken } from "@/lib/share";
import { removeFile } from "@/lib/files";
import { whatsappLink } from "@/lib/contact";
import { loadFx } from "@/lib/data";
import { pickCurrency, type Fx } from "@/lib/fx";
import { LEAD_STATUSES } from "@/lib/leads";
import type { ReminderData } from "@/lib/remind";

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
  const [prev, fx] = await Promise.all([prisma.task.findFirst({ where: { id, userId } }), loadFx(userId)]);
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
      ...(f.has("currency") ? { currency: pickCurrency(fx, str(f, "currency", 3)) } : {}),
    },
  });
  done();
}

/** An income row for money received on a job: stored in the main currency, keeping what was typed if it was another. */
const incomeFrom = (fx: Fx, amount: number, currency: string | null) => {
  const foreign = fx.of(currency) !== fx.base;
  return { amount: fx.toBase(amount, currency), ...(foreign ? { origAmount: amount, origCurrency: fx.of(currency) } : {}) };
};

/** «قبضت الباقي»: mark a task fully paid and record the remaining amount as income today. */
export async function collectRemaining(id: string) {
  const userId = await requireUser();
  const [t, fx] = await Promise.all([prisma.task.findFirst({ where: { id, userId } }), loadFx(userId)]);
  if (!t?.agreed) return;
  const remaining = t.agreed - (t.paid ?? 0);
  if (remaining <= 0) return;
  // Only the request that still sees the old «paid» wins, so a double tap never records the income twice.
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.task.updateMany({ where: { id, userId, paid: t.paid }, data: { paid: t.agreed } });
    if (!claimed.count) return;
    await tx.entry.create({ data: { userId, kind: "income", name: t.title.slice(0, 120), client: t.client, date: now(), ...incomeFrom(fx, remaining, t.currency) } });
    // Whatever payments were still planned are covered by this one.
    await tx.installment.updateMany({ where: { taskId: id, userId, paidAt: null }, data: { paidAt: now() } });
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
  const fx = await loadFx(userId);
  const money = incomeFrom(fx, amount, pickCurrency(fx, str(f, "currency", 3)));
  await prisma.entry.create({
    data: kind === "subscription"
      ? { userId, kind, name, ...money, startMonth: isMonthKey(month) ? month : monthKey(now()) }
      : { userId, kind, name, ...money, client: str(f, "client", 80), date: parseDay(str(f, "date", 10)) ?? now() },
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
/** Your details on invoices and quotes: name, phone, address and how clients can pay you. */
export async function setName(f: FormData) {
  const userId = await requireUser();
  const data: { name: string; bizPhone?: string; bizAddress?: string; payInfo?: string } = { name: str(f, "name", 80) };
  if (f.has("bizPhone")) data.bizPhone = str(f, "bizPhone", 40);
  if (f.has("bizAddress")) data.bizAddress = str(f, "bizAddress", 200);
  if (f.has("payInfo")) data.payInfo = str(f, "payInfo", 600);
  await prisma.user.update({ where: { id: userId }, data });
  done();
}

/** Exchange rates: how much of the main currency one unit of each other currency is worth. */
export async function setRates(f: FormData) {
  const userId = await requireUser();
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
  const rates: Record<string, number> = {};
  for (const c of CURRENCIES) {
    if (c.code === u?.currency) continue;
    const v = num(f, `rate_${c.code}`);
    if (v && v > 0 && v < 1e6) rates[c.code] = v;
  }
  await prisma.user.update({ where: { id: userId }, data: { fxRates: JSON.stringify(rates) } });
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
  const fx = await loadFx(userId);
  const q = await prisma.quote.create({
    data: { userId, title, client: str(f, "client", 80), items, validDays, currency: pickCurrency(fx, str(f, "currency", 3)), deliveryDays: delivery ? Math.min(365, Math.round(delivery)) : null, notes: str(f, "notes", 2000) },
  });
  revalidatePath("/app/quotes");
  redirect(`/app/quotes/${q.id}`);
}

/** The client said yes (told the owner): make the task once and open it. */
export async function acceptQuote(id: string) {
  const userId = await requireUser();
  const r = await acceptQuoteFor(userId, id);
  done();
  if (r?.taskId) redirect(`/app/tasks/${r.taskId}`);
}

// ---------- client links ----------
export async function shareQuote(id: string) {
  const userId = await requireUser();
  await prisma.quote.updateMany({ where: { id, userId, shareToken: null }, data: { shareToken: newToken() } });
  revalidatePath(`/app/quotes/${id}`);
}
export async function unshareQuote(id: string) {
  const userId = await requireUser();
  await prisma.quote.updateMany({ where: { id, userId }, data: { shareToken: null } });
  revalidatePath(`/app/quotes/${id}`);
}
export async function shareInvoice(id: string) {
  const userId = await requireUser();
  await prisma.task.updateMany({ where: { id, userId, shareToken: null }, data: { shareToken: newToken() } });
  revalidatePath(`/app/tasks/${id}/invoice`);
}
export async function unshareInvoice(id: string) {
  const userId = await requireUser();
  await prisma.task.updateMany({ where: { id, userId }, data: { shareToken: null } });
  revalidatePath(`/app/tasks/${id}/invoice`);
}

export async function deleteQuote(id: string) {
  const userId = await requireUser();
  await prisma.quote.deleteMany({ where: { id, userId } });
  revalidatePath("/app/quotes");
  redirect("/app/quotes");
}

// ---------- monthly (recurring) jobs ----------
export async function addRecurring(f: FormData) {
  const userId = await requireUser();
  const title = str(f, "title"), amount = num(f, "amount");
  if (!title || !amount) return;
  const day = Math.min(31, Math.max(1, Math.round(num(f, "day") ?? 1)));
  await prisma.recurringJob.create({ data: { userId, title, client: str(f, "client", 80), amount, dayOfMonth: day } });
  await runRecurring(prisma, now(), userId); // this month's task right away
  done();
}

export async function toggleRecurring(id: string) {
  const userId = await requireUser();
  const j = await prisma.recurringJob.findFirst({ where: { id, userId } });
  if (!j) return;
  await prisma.recurringJob.updateMany({ where: { id, userId }, data: { active: !j.active } });
  if (!j.active) await runRecurring(prisma, now(), userId);
  done();
}

export async function deleteRecurring(id: string) {
  const userId = await requireUser();
  await prisma.recurringJob.deleteMany({ where: { id, userId } });
  done();
}

// ---------- timer ----------
/** Start this task's timer; any other running timer of the user is stopped first (one at a time). */
export async function startTimer(id: string) {
  const userId = await requireUser();
  const running = await prisma.task.findMany({ where: { userId, timerStart: { not: null }, NOT: { id } }, select: { id: true } });
  for (const r of running) await stopFor(userId, r.id);
  await prisma.task.updateMany({ where: { id, userId, timerStart: null }, data: { timerStart: new Date() } });
  done();
}

export async function stopTimer(id: string) {
  await stopFor(await requireUser(), id);
  done();
}

/**
 * Focus mode ended: stop the timer but count only up to the end of the focus block (`untilMs`),
 * so coming back to the page late doesn't add the idle time.
 */
export async function stopTimerAt(id: string, untilMs: number) {
  await stopFor(await requireUser(), id, Number.isFinite(untilMs) ? untilMs : undefined);
  done();
}

/** Add the running session to timeSpent. Conditional on the same start, so a double stop adds it once. */
async function stopFor(userId: string, id: string, untilMs?: number) {
  const t = await prisma.task.findFirst({ where: { id, userId }, select: { timerStart: true } });
  if (!t?.timerStart) return;
  const end = Math.min(Date.now(), untilMs ?? Date.now());
  const sec = Math.max(0, Math.floor((end - t.timerStart.getTime()) / 1000));
  await prisma.task.updateMany({ where: { id, userId, timerStart: t.timerStart }, data: { timerStart: null, timeSpent: { increment: sec } } });
}

// ---------- deliveries & revisions ----------
const taskPath = (id: string) => revalidatePath(`/app/tasks/${id}`);

export async function deleteDelivery(id: string) {
  const userId = await requireUser();
  const d = await prisma.delivery.findFirst({ where: { id, userId } });
  if (!d) return;
  await prisma.delivery.deleteMany({ where: { id, userId } });
  await removeFile(d.url);
  taskPath(d.taskId);
}

export async function setRevisionsAllowed(taskId: string, f: FormData) {
  const userId = await requireUser();
  const n = num(f, "allowed");
  await prisma.task.updateMany({ where: { id: taskId, userId }, data: { revisionsAllowed: n === null ? null : Math.min(99, Math.round(n)) } });
  taskPath(taskId);
}

/** The owner logs a revision the client asked for elsewhere (WhatsApp, a call). */
export async function addRevision(taskId: string, f: FormData) {
  const userId = await requireUser();
  const t = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true } });
  if (!t) return;
  await prisma.$transaction([
    prisma.revision.create({ data: { taskId, userId, note: str(f, "note", 1000), by: "owner" } }),
    prisma.task.updateMany({ where: { id: taskId, userId }, data: { approvedAt: null } }),
  ]);
  taskPath(taskId);
}

export async function deleteRevision(id: string) {
  const userId = await requireUser();
  const r = await prisma.revision.findFirst({ where: { id, userId }, select: { taskId: true } });
  if (!r) return;
  await prisma.revision.deleteMany({ where: { id, userId } });
  taskPath(r.taskId);
}

export async function shareReview(taskId: string) {
  const userId = await requireUser();
  await prisma.task.updateMany({ where: { id: taskId, userId, reviewToken: null }, data: { reviewToken: newToken() } });
  taskPath(taskId);
}
export async function unshareReview(taskId: string) {
  const userId = await requireUser();
  await prisma.task.updateMany({ where: { id: taskId, userId }, data: { reviewToken: null } });
  taskPath(taskId);
}

// ---------- checklist ----------
export async function addSubtask(taskId: string, f: FormData) {
  const userId = await requireUser();
  const titles = str(f, "title", 2000).split("\n").map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 30);
  const t = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true, _count: { select: { subtasks: true } } } });
  if (!t || !titles.length || t._count.subtasks + titles.length > 60) return;
  await prisma.subtask.createMany({ data: titles.map((title, i) => ({ taskId, userId, title, position: t._count.subtasks + i })) });
  taskPath(taskId);
}

export async function toggleSubtask(id: string) {
  const userId = await requireUser();
  const s = await prisma.subtask.findFirst({ where: { id, userId } });
  if (!s) return;
  await prisma.subtask.updateMany({ where: { id, userId }, data: { done: !s.done } });
  taskPath(s.taskId);
  revalidatePath("/app", "layout");
}

export async function deleteSubtask(id: string) {
  const userId = await requireUser();
  const s = await prisma.subtask.findFirst({ where: { id, userId }, select: { taskId: true } });
  if (!s) return;
  await prisma.subtask.deleteMany({ where: { id, userId } });
  taskPath(s.taskId);
}

// ---------- clients ----------
export async function saveClientInfo(name: string, f: FormData) {
  const userId = await requireUser();
  const n = name.trim().slice(0, 80);
  if (!n) return;
  const data = { phone: str(f, "phone", 40), email: str(f, "email", 120), notes: str(f, "notes", 2000) };
  await prisma.clientInfo.upsert({ where: { userId_name: { userId, name: n } }, create: { userId, name: n, ...data }, update: data });
  revalidatePath(`/app/clients/${encodeURIComponent(n)}`);
}

// ---------- payment reminder ----------
/**
 * What a payment reminder to one client needs: every job they still owe on, each with a live invoice link
 * (made now if the invoice wasn't shared yet), plus their phone and the sender's name.
 */
export async function prepareReminder(client: string): Promise<ReminderData | null> {
  const userId = await requireUser();
  const name = client.trim().slice(0, 80);
  if (!name) return null;
  const owing = await prisma.task.findMany({ where: { userId, client: name, agreed: { gt: 0 } }, orderBy: { createdAt: "asc" } });
  const tasks = owing.filter((t) => (t.agreed ?? 0) > (t.paid ?? 0));
  if (!tasks.length) return null;
  // Only fills a missing token, so a link the client already has keeps working.
  await Promise.all(tasks.filter((t) => !t.shareToken).map((t) =>
    prisma.task.updateMany({ where: { id: t.id, userId, shareToken: null }, data: { shareToken: newToken() } })));
  const [fresh, user, info, fx] = await Promise.all([
    prisma.task.findMany({ where: { id: { in: tasks.map((t) => t.id) }, userId }, select: { id: true, shareToken: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    prisma.clientInfo.findUnique({ where: { userId_name: { userId, name } }, select: { phone: true } }),
    loadFx(userId),
  ]);
  const token = new Map(fresh.map((t) => [t.id, t.shareToken]));
  const codes = new Set(tasks.map((t) => fx.of(t.currency)));
  const one = codes.size === 1 ? [...codes][0] : fx.base;
  const rem = (t: (typeof tasks)[number]) => (t.agreed ?? 0) - (t.paid ?? 0);
  return {
    client: name,
    sender: user?.name ?? "",
    cur: fx.short(one),
    total: tasks.reduce((s, t) => s + (codes.size === 1 ? rem(t) : fx.toBase(rem(t), t.currency)), 0),
    phone: info?.phone ? whatsappLink(info.phone) : null,
    tasks: tasks.map((t) => ({ title: t.title, remaining: rem(t), cur: fx.short(t.currency), path: `/s/i/${token.get(t.id)}` })),
  };
}

// ---------- installments ----------
/**
 * Sets the planned payments of a task from the form (label/amount/due rows). Payments already marked paid
 * stay as they are; the unpaid ones are replaced. With no agreed price yet, the total becomes the price.
 */
export async function saveInstallments(taskId: string, f: FormData) {
  const userId = await requireUser();
  const task = await prisma.task.findFirst({ where: { id: taskId, userId }, select: { id: true, agreed: true } });
  if (!task) return;
  const labels = f.getAll("label").map((v) => String(v).trim().slice(0, 60));
  const amounts = f.getAll("amount").map((v) => Number(String(v).replace(/[,٬\s]/g, "")));
  const dues = f.getAll("due").map((v) => parseDay(String(v)));
  const rows = labels.flatMap((label, i) => {
    const amount = amounts[i];
    return Number.isFinite(amount) && amount > 0 ? [{ label: label || `دفعة ${i + 1}`, amount, due: dues[i] ?? null }] : [];
  }).slice(0, 12);
  await prisma.$transaction(async (tx) => {
    const paid = await tx.installment.findMany({ where: { taskId, userId, paidAt: { not: null } }, select: { amount: true } });
    await tx.installment.deleteMany({ where: { taskId, userId, paidAt: null } });
    await tx.installment.createMany({ data: rows.map((r, i) => ({ ...r, taskId, userId, position: paid.length + i })) });
    if (!task.agreed && rows.length) {
      await tx.task.updateMany({ where: { id: taskId, userId }, data: { agreed: [...paid, ...rows].reduce((s, x) => s + x.amount, 0) } });
    }
  });
  done();
}

/** Marks a payment received: adds it to what the task has been paid and records it as income, once. */
export async function payInstallment(id: string) {
  const userId = await requireUser();
  const [x, fx] = await Promise.all([
    prisma.installment.findFirst({ where: { id, userId }, include: { task: { select: { title: true, client: true, currency: true } } } }),
    loadFx(userId),
  ]);
  if (!x || x.paidAt) return;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.installment.updateMany({ where: { id, userId, paidAt: null }, data: { paidAt: now() } });
    if (!claimed.count) return;
    const e = await tx.entry.create({ data: { userId, kind: "income", name: `${x.task.title} — ${x.label}`.slice(0, 120), client: x.task.client, date: now(), ...incomeFrom(fx, x.amount, x.task.currency) } });
    await tx.installment.update({ where: { id }, data: { entryId: e.id } });
    // COALESCE: a task with nothing paid yet has paid = NULL, and NULL + x stays NULL.
    await tx.$executeRaw`UPDATE "Task" SET "paid" = COALESCE("paid", 0) + ${x.amount} WHERE "id" = ${x.taskId} AND "userId" = ${userId}`;
  });
  done();
}

/** Undo a payment marked by mistake: takes it off the task and removes the income it recorded. */
export async function unpayInstallment(id: string) {
  const userId = await requireUser();
  const x = await prisma.installment.findFirst({ where: { id, userId } });
  if (!x?.paidAt) return;
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.installment.updateMany({ where: { id, userId, paidAt: { not: null } }, data: { paidAt: null, entryId: null } });
    if (!claimed.count) return;
    if (x.entryId) await tx.entry.deleteMany({ where: { id: x.entryId, userId } });
    await tx.$executeRaw`UPDATE "Task" SET "paid" = NULLIF(GREATEST(COALESCE("paid", 0) - ${x.amount}, 0), 0) WHERE "id" = ${x.taskId} AND "userId" = ${userId}`;
  });
  done();
}

export async function deleteInstallment(id: string) {
  const userId = await requireUser();
  await prisma.installment.deleteMany({ where: { id, userId, paidAt: null } });
  done();
}

// ---------- client portal ----------
/** Turns on the client's portal link (one link for all their quotes, invoices and deliveries). */
export async function sharePortal(client: string) {
  const userId = await requireUser();
  const name = client.trim().slice(0, 80);
  if (!name) return;
  await prisma.clientInfo.upsert({ where: { userId_name: { userId, name } }, create: { userId, name, portalToken: newToken() }, update: {} });
  await prisma.clientInfo.updateMany({ where: { userId, name, portalToken: null }, data: { portalToken: newToken() } });
  done();
}

export async function unsharePortal(client: string) {
  const userId = await requireUser();
  await prisma.clientInfo.updateMany({ where: { userId, name: client.trim().slice(0, 80) }, data: { portalToken: null } });
  done();
}

// ---------- task templates ----------
const templateSteps = (raw: string) => raw.split("\n").map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 30);
const templateData = (f: FormData) => {
  const days = num(f, "days");
  return {
    name: str(f, "name", 200),
    amount: num(f, "amount"),
    days: days !== null && days <= 365 ? Math.round(days) : null,
    steps: templateSteps(str(f, "steps", 6000)).join("\n"),
    notes: str(f, "notes", 2000),
  };
};

export async function addTemplate(f: FormData) {
  const userId = await requireUser();
  const d = templateData(f);
  if (!d.name) return;
  await prisma.taskTemplate.create({ data: { userId, ...d } });
  done();
}

export async function updateTemplate(id: string, f: FormData) {
  const userId = await requireUser();
  const d = templateData(f);
  if (!d.name) return;
  await prisma.taskTemplate.updateMany({ where: { id, userId }, data: d });
  done();
}

export async function deleteTemplate(id: string) {
  const userId = await requireUser();
  await prisma.taskTemplate.deleteMany({ where: { id, userId } });
  done();
}

/** Keeps a task's title, price, steps, notes and delivery time as a template for next time. */
export async function saveTaskAsTemplate(taskId: string) {
  const userId = await requireUser();
  const t = await prisma.task.findFirst({ where: { id: taskId, userId }, include: { subtasks: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] } } });
  if (!t) return;
  const days = t.due ? Math.max(1, Math.round((t.due.getTime() - t.createdAt.getTime()) / 86_400_000)) : null;
  await prisma.taskTemplate.create({
    data: { userId, name: t.title, amount: t.agreed, days: days && days <= 365 ? days : null, steps: t.subtasks.map((s) => s.title).join("\n"), notes: t.notes.slice(0, 2000) },
  });
  done();
  redirect("/app/templates?saved=1");
}

/** Starts a task from a template: its price, checklist and due date (template days from today). */
export async function startFromTemplate(id: string, f: FormData) {
  const userId = await requireUser();
  const tpl = await prisma.taskTemplate.findFirst({ where: { id, userId } });
  if (!tpl) return;
  const today = now();
  const task = await prisma.task.create({
    data: {
      userId,
      title: str(f, "title") || tpl.name,
      client: str(f, "client", 80),
      agreed: tpl.amount,
      due: tpl.days ? new Date(today.getFullYear(), today.getMonth(), today.getDate() + tpl.days) : null,
      notes: tpl.notes,
      source: "manual",
      subtasks: { create: templateSteps(tpl.steps).map((title, i) => ({ userId, title, position: i })) },
    },
  });
  done();
  redirect(`/app/tasks/${task.id}`);
}

// ---------- leads ----------
const leadPath = () => revalidatePath("/app/leads");

export async function addLead(f: FormData) {
  const userId = await requireUser();
  const name = str(f, "name", 80);
  if (!name) return;
  await prisma.lead.create({
    data: {
      userId, name, contact: str(f, "contact", 120), need: str(f, "need", 500), budget: num(f, "budget"),
      source: str(f, "source", 60), nextAt: parseDay(str(f, "nextAt", 10)),
    },
  });
  leadPath();
}

/** Move a lead to another stage. Won/lost close it; reopening clears the close date. */
export async function setLeadStatus(id: string, status: string) {
  const userId = await requireUser();
  if (!LEAD_STATUSES.includes(status) || status === "won") return;
  const closing = status === "lost";
  await prisma.lead.updateMany({ where: { id, userId }, data: { status, closedAt: closing ? now() : null, ...(closing ? { nextAt: null } : {}) } });
  leadPath();
}

export async function updateLead(id: string, f: FormData) {
  const userId = await requireUser();
  const name = str(f, "name", 80);
  if (!name) return;
  await prisma.lead.updateMany({
    where: { id, userId },
    data: { name, contact: str(f, "contact", 120), need: str(f, "need", 500), budget: num(f, "budget"), source: str(f, "source", 60), nextAt: parseDay(str(f, "nextAt", 10)), notes: str(f, "notes", 2000) },
  });
  leadPath();
}

/** Push the follow-up by some days (from today). */
export async function snoozeLead(id: string, days: number) {
  const userId = await requireUser();
  const d = Math.min(60, Math.max(1, Math.round(days)));
  const t = now();
  await prisma.lead.updateMany({ where: { id, userId }, data: { nextAt: new Date(t.getFullYear(), t.getMonth(), t.getDate() + d) } });
  leadPath();
}

export async function deleteLead(id: string) {
  const userId = await requireUser();
  await prisma.lead.deleteMany({ where: { id, userId } });
  leadPath();
}

/**
 * «اتفقنا»: the lead becomes a task (their request, their budget as the price) and a client with their
 * contact saved. Once only: a second tap opens the same task.
 */
export async function winLead(id: string) {
  const userId = await requireUser();
  const lead = await prisma.lead.findFirst({ where: { id, userId } });
  if (!lead) return;
  let taskId = lead.taskId;
  if (!taskId) {
    taskId = await prisma.$transaction(async (tx) => {
      const claimed = await tx.lead.updateMany({ where: { id, userId, taskId: null }, data: { status: "won", closedAt: now(), nextAt: null } });
      if (!claimed.count) return null;
      const t = await tx.task.create({ data: { userId, title: (lead.need || `شغل ${lead.name}`).slice(0, 200), client: lead.name, agreed: lead.budget, notes: lead.notes, source: "manual" } });
      await tx.lead.updateMany({ where: { id, userId }, data: { taskId: t.id } });
      if (lead.contact) {
        const isEmail = lead.contact.includes("@");
        await tx.clientInfo.upsert({
          where: { userId_name: { userId, name: lead.name } },
          create: { userId, name: lead.name, ...(isEmail ? { email: lead.contact } : { phone: lead.contact }) },
          update: {},
        });
      }
      return t.id;
    });
    taskId ??= (await prisma.lead.findFirst({ where: { id, userId }, select: { taskId: true } }))?.taskId ?? null;
  }
  done();
  if (taskId) redirect(`/app/tasks/${taskId}`);
}
