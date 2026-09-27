import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { filesConfigured, putFile, removeFile } from "@/lib/files";
import { sniffType } from "@/lib/revisions";

const MAX_LOGO = 1024 * 1024;
// Raster only: an SVG can carry script, and the logo is shown on public client pages.
const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Upload the logo shown on invoices and quotes (replaces the old one). */
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  if (!filesConfigured()) return NextResponse.json({ error: "رفع الملفات لسه مش متفعّل على الموقع." }, { status: 501 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "اختار صورة اللوجو." }, { status: 400 });
  if (file.size > MAX_LOGO) return NextResponse.json({ error: "اللوجو أكبر من ١ ميجا." }, { status: 413 });
  const data = Buffer.from(await file.arrayBuffer());
  const type = sniffType(data);
  if (!type || !TYPES[type]) return NextResponse.json({ error: "اللوجو لازم يكون PNG أو JPG أو WEBP." }, { status: 415 });
  const url = await putFile(`logo/${uid}/logo.${TYPES[type]}`, data, type);
  const old = await prisma.user.findUnique({ where: { id: uid }, select: { logoUrl: true } });
  await prisma.user.update({ where: { id: uid }, data: { logoUrl: url } });
  if (old?.logoUrl) await removeFile(old.logoUrl);
  return NextResponse.json({ url });
}

export async function DELETE() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  const old = await prisma.user.findUnique({ where: { id: uid }, select: { logoUrl: true } });
  await prisma.user.update({ where: { id: uid }, data: { logoUrl: null } });
  if (old?.logoUrl) await removeFile(old.logoUrl);
  return NextResponse.json({ ok: true });
}
