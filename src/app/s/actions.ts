"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { isToken, acceptQuoteFor } from "@/lib/share";
import { pushToUser } from "@/lib/push";

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
