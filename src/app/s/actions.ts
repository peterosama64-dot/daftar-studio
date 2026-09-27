"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isToken, acceptQuoteFor } from "@/lib/share";
import { pushToUser } from "@/lib/push";
import { portalFor } from "@/lib/portal";
import { quoteExpired } from "@/lib/quote";

/** The client accepts from the public link. Only a live link on a draft quote can do this. */
export async function acceptSharedQuote(token: string) {
  if (!isToken(token)) return;
  const q = await prisma.quote.findUnique({ where: { shareToken: token, user: { suspendedAt: null } }, select: { id: true, userId: true, client: true, title: true } });
  if (!q) return;
  const r = await acceptQuoteFor(q.userId, q.id);
  if (r?.fresh) {
    await pushToUser(q.userId, {
      title: `${q.client || "العميل"} وافق على عرض السعر`,
      body: `«${q.title}» اتحوّل لمهمة في الدفتر.`,
      url: r.taskId ? `/app/tasks/${r.taskId}` : "/app/quotes",
      tag: `daftar-quote-${q.id}`,
    }).catch(() => {});
  }
  revalidatePath(`/s/q/${token}`);
}

/** Client approves the delivered work from the review link. */
export async function approveWork(token: string) {
  if (!isToken(token)) return;
  const t = await prisma.task.findUnique({ where: { reviewToken: token, user: { suspendedAt: null } }, select: { id: true, userId: true, title: true, client: true, approvedAt: true } });
  if (!t || t.approvedAt) return;
  const done = await prisma.task.updateMany({ where: { id: t.id, approvedAt: null }, data: { approvedAt: new Date() } });
  if (done.count) {
    await pushToUser(t.userId, { title: `${t.client || "العميل"} وافق على الشغل`, body: `«${t.title}» اتوافق عليه.`, url: `/app/tasks/${t.id}`, tag: `daftar-review-${t.id}` }).catch(() => {});
  }
  revalidatePath(`/s/r/${token}`);
}

/** Client asks for a revision from the review link (note required, capped per task). */
export async function requestRevision(token: string, f: FormData) {
  if (!isToken(token)) return;
  const note = String(f.get("note") ?? "").trim().slice(0, 1000);
  if (!note) return;
  const t = await prisma.task.findUnique({ where: { reviewToken: token, user: { suspendedAt: null } }, select: { id: true, userId: true, title: true, client: true, _count: { select: { revisions: true } } } });
  if (!t || t._count.revisions >= 50) return;
  await prisma.$transaction([
    prisma.revision.create({ data: { taskId: t.id, userId: t.userId, note, by: "client" } }),
    prisma.task.updateMany({ where: { id: t.id }, data: { approvedAt: null } }),
  ]);
  await pushToUser(t.userId, { title: `${t.client || "العميل"} طلب تعديل`, body: `«${t.title}»: ${note.slice(0, 120)}`, url: `/app/tasks/${t.id}`, tag: `daftar-review-${t.id}` }).catch(() => {});
  revalidatePath(`/s/r/${token}`);
}

/** The client accepts a quote from their portal. Only a quote of that owner, for that client. */
export async function acceptPortalQuote(token: string, id: string) {
  const p = await portalFor(token);
  if (!p) return;
  const q = await prisma.quote.findFirst({ where: { id, userId: p.userId, client: p.name }, select: { id: true, title: true, status: true, createdAt: true, validDays: true } });
  if (!q || (q.status !== "accepted" && quoteExpired(q.createdAt, q.validDays))) return;
  const r = await acceptQuoteFor(p.userId, q.id);
  if (r?.fresh) {
    await pushToUser(p.userId, {
      title: `${p.name} وافق على عرض السعر`,
      body: `«${q.title}» اتحوّل لمهمة في الدفتر.`,
      url: r.taskId ? `/app/tasks/${r.taskId}` : "/app/quotes",
      tag: `daftar-quote-${q.id}`,
    }).catch(() => {});
  }
  revalidatePath(`/s/c/${token}`, "layout");
}

/** The client accepts the contract by typing their name. Stores exactly the text they accepted. */
export async function acceptContract(token: string, f: FormData) {
  if (!isToken(token)) return;
  const name = String(f.get("name") ?? "").trim().slice(0, 80);
  if (name.length < 2 || f.get("agree") !== "on") return;
  const c = await prisma.contract.findUnique({ where: { shareToken: token, task: { user: { suspendedAt: null } } }, select: { id: true, body: true, userId: true, task: { select: { id: true, title: true, client: true } } } });
  if (!c) return;
  const done = await prisma.contract.updateMany({ where: { id: c.id, acceptedAt: null, body: c.body }, data: { acceptedAt: new Date(), acceptedName: name, acceptedBody: c.body } });
  if (done.count) {
    await pushToUser(c.userId, { title: `${c.task.client || name} وافق على العقد`, body: `«${c.task.title}» — باسم ${name}`, url: `/app/tasks/${c.task.id}/contract`, tag: `daftar-contract-${c.id}` }).catch(() => {});
  }
  revalidatePath(`/s/k/${token}`);
}
