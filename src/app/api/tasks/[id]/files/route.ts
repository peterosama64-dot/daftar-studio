import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { filesConfigured, putFile } from "@/lib/files";
import { ACCEPTED_TYPES, MAX_FILE, currentRound, safeName, sniffType } from "@/lib/revisions";

// Upload one delivered file (image or PDF) to a task. The browser shrinks big images before sending.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  if (!filesConfigured()) return NextResponse.json({ error: "رفع الملفات لسه مش متفعّل على الموقع." }, { status: 501 });
  const { id } = await params;
  const task = await prisma.task.findFirst({ where: { id, userId: uid }, select: { id: true, _count: { select: { revisions: true, deliveries: true } } } });
  if (!task) return NextResponse.json({ error: "المهمة مش موجودة." }, { status: 404 });
  if (task._count.deliveries >= 200) return NextResponse.json({ error: "وصلت لأقصى عدد ملفات للمهمة دي." }, { status: 400 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "مفيش ملف." }, { status: 400 });
  if (file.size > MAX_FILE) return NextResponse.json({ error: "الملف أكبر من ٤ ميجا. صغّره أو ابعته PDF أخف." }, { status: 413 });
  const data = Buffer.from(await file.arrayBuffer());
  const type = sniffType(data);
  if (!type || !ACCEPTED_TYPES[type]) return NextResponse.json({ error: "الملفات المسموحة: صور (JPG, PNG, WEBP, GIF) أو PDF." }, { status: 415 });

  const name = safeName(file.name).replace(/\.[^.]*$/, "") + "." + ACCEPTED_TYPES[type];
  const url = await putFile(`t/${task.id}/${name}`, data, type);
  const d = await prisma.delivery.create({
    data: { taskId: task.id, userId: uid, url, name, type, size: data.length, round: currentRound(task._count.revisions) },
  });
  return NextResponse.json({ id: d.id, url, round: d.round });
}
