import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { currentUserId } from "@/lib/auth";
import { parseDay } from "@/lib/dates";
import { OfflineOp } from "@/lib/offline";

const Body = z.object({ ops: z.array(z.unknown()).min(1).max(100) });

/**
 * Saves what was recorded offline. Each item carries an id made on the phone; the id is stored with the
 * item in one transaction, so sending the same item twice (a lost reply, two tabs) saves it once.
 * Answers with the ids that are now saved (new or already there) so the phone can drop them.
 */
export async function POST(req: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "طلب مش مظبوط." }, { status: 400 });
  const done: string[] = [], rejected: string[] = [];
  for (const raw of body.data.ops) {
    const p = OfflineOp.safeParse(raw);
    if (!p.success) { const id = (raw as { id?: unknown })?.id; if (typeof id === "string") rejected.push(id); continue; }
    const op = p.data;
    // Recorded under another account on this phone: never save it into this one.
    if (op.uid !== userId) { rejected.push(op.id); continue; }
    if ((op.kind !== "task" && op.amount === null)) { rejected.push(op.id); continue; }
    const date = parseDay(op.date) ?? new Date();
    try {
      await prisma.$transaction([
        prisma.syncedOp.create({ data: { id: op.id, userId } }),
        op.kind === "task"
          ? prisma.task.create({ data: { userId, title: op.title, client: op.client, agreed: op.amount, source: "manual" } })
          : prisma.entry.create({ data: { userId, kind: op.kind, name: op.title, client: op.client, amount: op.amount!, date } }),
      ]);
      done.push(op.id);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const mine = await prisma.syncedOp.findFirst({ where: { id: op.id, userId }, select: { id: true } });
        (mine ? done : rejected).push(op.id);
      } else throw e;
    }
  }
  if (done.length) revalidatePath("/app", "layout");
  return NextResponse.json({ done, rejected });
}
