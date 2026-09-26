import { NextResponse } from "next/server";
import { z } from "zod";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";

const Sub = z.object({
  endpoint: z.string().url().startsWith("https://").max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
});

/** Save this browser for reminders (POST) or forget it (DELETE). */
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  const p = Sub.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "بيانات الجهاز مش مظبوطة." }, { status: 400 });
  const { endpoint, keys } = p.data;
  // An endpoint belongs to one browser; if it was saved under another account on this device, move it.
  await prisma.pushSubscription.upsert({ where: { endpoint }, create: { userId: uid, endpoint, ...keys }, update: { userId: uid, ...keys } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  const endpoint = String(((await req.json().catch(() => ({}))) as { endpoint?: unknown }).endpoint ?? "");
  await prisma.pushSubscription.deleteMany({ where: { userId: uid, endpoint } });
  return NextResponse.json({ ok: true });
}
