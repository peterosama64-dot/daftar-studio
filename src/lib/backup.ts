import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "./db";
import { CURRENCIES } from "./constants";
import { CATEGORY_KEYS } from "./categories";

// A full copy of one account's notebook as JSON, and restoring it (into the same or another account).
// Left out on purpose: password, Gmail tokens, notification subscriptions and every share link
// (links are made again when needed, so an old copy never reopens a link that was turned off).

export const BACKUP_APP = "daftar-studio";
export const BACKUP_VERSION = 1;

export async function buildBackup(userId: string) {
  const [user, tasks, entries, quotes, recurring, clients, templates] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { name: true, currency: true, fxRates: true, budgets: true, incomeGoal: true, logoUrl: true, bizPhone: true, bizAddress: true, payInfo: true } }),
    prisma.task.findMany({
      where: { userId }, orderBy: { createdAt: "asc" },
      include: {
        subtasks: { select: { title: true, done: true, position: true } },
        installments: { select: { label: true, amount: true, due: true, paidAt: true, entryId: true, position: true } },
        revisions: { select: { note: true, by: true, createdAt: true } },
        deliveries: { select: { url: true, name: true, type: true, size: true, round: true, createdAt: true } },
      },
    }),
    prisma.entry.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.quote.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    prisma.recurringJob.findMany({ where: { userId } }),
    prisma.clientInfo.findMany({ where: { userId }, select: { name: true, phone: true, email: true, notes: true } }),
    prisma.taskTemplate.findMany({ where: { userId }, select: { name: true, amount: true, days: true, steps: true, notes: true, createdAt: true } }),
  ]);
  return {
    app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    profile: user,
    tasks: tasks.map((t) => ({
      ref: t.id, title: t.title, client: t.client, due: t.due, priority: t.priority, status: t.status, source: t.source, notes: t.notes,
      agreed: t.agreed, paid: t.paid, currency: t.currency, doneAt: t.doneAt, timeSpent: t.timeSpent, recurringRef: t.recurringId,
      revisionsAllowed: t.revisionsAllowed, approvedAt: t.approvedAt, createdAt: t.createdAt,
      subtasks: t.subtasks, installments: t.installments.map(({ entryId, ...x }) => ({ ...x, entryRef: entryId })), revisions: t.revisions, deliveries: t.deliveries,
    })),
    entries: entries.map((e) => ({
      ref: e.id, kind: e.kind, name: e.name, client: e.client, amount: e.amount, date: e.date, startMonth: e.startMonth, endMonth: e.endMonth,
      origAmount: e.origAmount, origCurrency: e.origCurrency, category: e.category, createdAt: e.createdAt,
    })),
    quotes: quotes.map((q) => ({
      client: q.client, title: q.title, items: q.items, validDays: q.validDays, deliveryDays: q.deliveryDays, notes: q.notes, status: q.status,
      taskRef: q.taskId, currency: q.currency, createdAt: q.createdAt,
    })),
    recurring: recurring.map((j) => ({ ref: j.id, title: j.title, client: j.client, amount: j.amount, dayOfMonth: j.dayOfMonth, active: j.active, lastMonth: j.lastMonth, createdAt: j.createdAt })),
    clients, templates,
  };
}

// ---------- restore ----------
const s = (max: number) => z.string().max(max);
const date = z.coerce.date();
const optDate = date.nullable().optional().transform((v) => v ?? null);
const money = z.number().finite().min(-1e12).max(1e12);
const cur = z.enum(CURRENCIES.map((c) => c.code) as [string, ...string[]]).nullable().optional().transform((v) => v ?? null);
const ref = s(64).nullable().optional().transform((v) => v ?? null);
const arr = <T extends z.ZodTypeAny>(t: T, max: number) => z.array(t).max(max).default([]);

export const BackupSchema = z.object({
  app: z.literal(BACKUP_APP),
  version: z.number().int().min(1).max(BACKUP_VERSION),
  profile: z.object({
    name: s(80).default(""), currency: z.enum(CURRENCIES.map((c) => c.code) as [string, ...string[]]).default("EGP"),
    fxRates: s(500).default("{}"), budgets: s(1000).default("{}"), incomeGoal: money.nullable().default(null),
    logoUrl: z.string().max(500).refine((u) => /^https:\/\//.test(u) || u.startsWith("/api/files/local/")).nullable().default(null),
    bizPhone: s(40).default(""), bizAddress: s(200).default(""), payInfo: s(600).default(""),
  }).nullable().default(null),
  tasks: arr(z.object({
    ref: s(64), title: s(200).min(1), client: s(80).default(""), due: optDate,
    priority: z.enum(["high", "normal", "low"]).default("normal"), status: z.enum(["todo", "doing", "done"]).default("todo"),
    source: z.enum(["manual", "voice", "gmail", "chat"]).default("manual"), notes: s(4000).default(""),
    agreed: money.nullable().default(null), paid: money.nullable().default(null), currency: cur, doneAt: optDate,
    timeSpent: z.number().int().min(0).max(1e9).default(0), recurringRef: ref, revisionsAllowed: z.number().int().min(0).max(1000).nullable().default(null),
    approvedAt: optDate, createdAt: date,
    subtasks: arr(z.object({ title: s(200).min(1), done: z.boolean().default(false), position: z.number().int().default(0) }), 60),
    installments: arr(z.object({ label: s(60), amount: money, due: optDate, paidAt: optDate, entryRef: ref, position: z.number().int().default(0) }), 12),
    revisions: arr(z.object({ note: s(1000).default(""), by: z.enum(["owner", "client"]).default("owner"), createdAt: date }), 50),
    deliveries: arr(z.object({ url: z.string().max(500).refine((u) => /^https:\/\//.test(u) || u.startsWith("/api/files/local/")), name: s(120), type: s(60), size: z.number().int().min(0), round: z.number().int().min(1).default(1), createdAt: date }), 200),
  }), 20_000),
  entries: arr(z.object({
    ref: s(64), kind: z.enum(["income", "subscription", "expense"]), name: s(120).min(1), client: s(80).default(""), amount: money,
    date: optDate, startMonth: s(7).nullable().default(null), endMonth: s(7).nullable().default(null),
    origAmount: money.nullable().optional().transform((v) => v ?? null), origCurrency: cur,
    category: z.enum(CATEGORY_KEYS as [string, ...string[]]).nullable().optional().transform((v) => v ?? null), createdAt: date,
  }), 50_000),
  quotes: arr(z.object({
    client: s(80).default(""), title: s(200).min(1), items: z.array(z.object({ desc: s(300), amount: money })).max(50),
    validDays: z.number().int().min(1).max(365).default(14), deliveryDays: z.number().int().min(0).max(365).nullable().default(null),
    notes: s(2000).default(""), status: z.enum(["draft", "accepted"]).default("draft"), taskRef: ref, currency: cur, createdAt: date,
  }), 5000),
  recurring: arr(z.object({ ref: s(64), title: s(200).min(1), client: s(80).default(""), amount: money, dayOfMonth: z.number().int().min(1).max(31).default(1), active: z.boolean().default(true), lastMonth: s(7).nullable().default(null), createdAt: date }), 500),
  clients: arr(z.object({ name: s(80).min(1), phone: s(40).default(""), email: s(200).default(""), notes: s(2000).default("") }), 5000),
  templates: arr(z.object({ name: s(200).min(1), amount: money.nullable().default(null), days: z.number().int().min(0).max(365).nullable().default(null), steps: s(6000).default(""), notes: s(2000).default(""), createdAt: date }), 1000),
});
export type Backup = z.infer<typeof BackupSchema>;

export function backupCounts(b: Backup) {
  return { tasks: b.tasks.length, entries: b.entries.length, quotes: b.quotes.length, recurring: b.recurring.length, clients: b.clients.length, templates: b.templates.length };
}

/**
 * Replaces everything in the account with the backup, all or nothing (one transaction). Rows get fresh
 * ids; links between them (quote → task, payment → income row, task → monthly job) follow the new ids.
 */
export async function restoreBackup(userId: string, b: Backup) {
  const id = () => randomUUID().replace(/-/g, "");
  const map = (list: { ref: string }[]) => new Map(list.map((x) => [x.ref, id()]));
  const taskIds = map(b.tasks), entryIds = map(b.entries), jobIds = map(b.recurring);
  const clientNames = [...new Map(b.clients.map((c) => [c.name, c])).values()];
  await prisma.$transaction(async (tx) => {
    await tx.task.deleteMany({ where: { userId } });
    await tx.entry.deleteMany({ where: { userId } });
    await tx.quote.deleteMany({ where: { userId } });
    await tx.recurringJob.deleteMany({ where: { userId } });
    await tx.clientInfo.deleteMany({ where: { userId } });
    await tx.taskTemplate.deleteMany({ where: { userId } });
    if (b.profile) await tx.user.update({ where: { id: userId }, data: b.profile });
    await tx.recurringJob.createMany({ data: b.recurring.map(({ ref, ...j }) => ({ ...j, id: jobIds.get(ref)!, userId })) });
    await tx.entry.createMany({ data: b.entries.map(({ ref, ...e }) => ({ ...e, id: entryIds.get(ref)!, userId })) });
    await tx.task.createMany({
      data: b.tasks.map((t) => ({
        title: t.title, client: t.client, due: t.due, priority: t.priority, status: t.status, source: t.source, notes: t.notes,
        agreed: t.agreed, paid: t.paid, currency: t.currency, doneAt: t.doneAt, timeSpent: t.timeSpent,
        revisionsAllowed: t.revisionsAllowed, approvedAt: t.approvedAt, createdAt: t.createdAt,
        id: taskIds.get(t.ref)!, userId, recurringId: t.recurringRef ? jobIds.get(t.recurringRef) ?? null : null,
      })),
    });
    const per = <T,>(pick: (t: Backup["tasks"][number]) => T[]) => b.tasks.flatMap((t) => pick(t).map((x) => ({ ...x, taskId: taskIds.get(t.ref)!, userId })));
    await tx.subtask.createMany({ data: per((t) => t.subtasks) });
    await tx.installment.createMany({ data: per((t) => t.installments.map(({ entryRef, ...x }) => ({ ...x, entryId: entryRef ? entryIds.get(entryRef) ?? null : null }))) });
    await tx.revision.createMany({ data: per((t) => t.revisions) });
    await tx.delivery.createMany({ data: per((t) => t.deliveries) });
    await tx.quote.createMany({ data: b.quotes.map(({ taskRef, ...q }) => ({ ...q, userId, taskId: taskRef ? taskIds.get(taskRef) ?? null : null })) });
    await tx.clientInfo.createMany({ data: clientNames.map((c) => ({ ...c, userId })) });
    await tx.taskTemplate.createMany({ data: b.templates.map((t) => ({ ...t, userId })) });
  }, { timeout: 60_000, maxWait: 10_000 });
}
