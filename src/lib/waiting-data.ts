import "server-only";
import { prisma } from "./db";
import type { WaitItem } from "./waiting";

/**
 * Everything sent to a client that is still waiting on them: delivered work with a review link and no
 * approval (unless the client already asked for changes — then it's the owner's turn), shared quotes not
 * accepted, and shared contracts not agreed to. `link` is the public path the client opens.
 */
export async function loadWaiting(userId: string): Promise<WaitItem[]> {
  const [tasks, quotes, contracts] = await Promise.all([
    prisma.task.findMany({
      where: { userId, reviewToken: { not: null }, approvedAt: null, deliveries: { some: {} } },
      select: { id: true, title: true, client: true, reviewToken: true, nudgedAt: true,
        deliveries: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        revisions: { where: { by: "client" }, select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      take: 100,
    }),
    prisma.quote.findMany({ where: { userId, shareToken: { not: null }, status: "draft" }, select: { id: true, title: true, client: true, shareToken: true, sharedAt: true, createdAt: true, nudgedAt: true }, take: 100 }),
    prisma.contract.findMany({ where: { userId, shareToken: { not: null }, acceptedAt: null }, select: { taskId: true, shareToken: true, sharedAt: true, updatedAt: true, nudgedAt: true, task: { select: { title: true, client: true } } }, take: 100 }),
  ]);
  const out: WaitItem[] = [];
  for (const t of tasks) {
    const last = t.deliveries[0]?.createdAt;
    const asked = t.revisions[0]?.createdAt;
    if (!last || (asked && asked > last)) continue;
    out.push({ kind: "delivery", id: t.id, title: t.title, client: t.client, since: last, nudgedAt: t.nudgedAt, link: `/s/r/${t.reviewToken}`, href: `/app/tasks/${t.id}` });
  }
  for (const q of quotes) out.push({ kind: "quote", id: q.id, title: q.title, client: q.client, since: q.sharedAt ?? q.createdAt, nudgedAt: q.nudgedAt, link: `/s/q/${q.shareToken}`, href: `/app/quotes/${q.id}` });
  for (const c of contracts) out.push({ kind: "contract", id: c.taskId, title: c.task.title, client: c.task.client, since: c.sharedAt ?? c.updatedAt, nudgedAt: c.nudgedAt, link: `/s/k/${c.shareToken}`, href: `/app/tasks/${c.taskId}/contract` });
  return out;
}
