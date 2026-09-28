import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { dayKey } from "@/lib/dates";

/** Download one of the weekly automatic copies (only the owner's). */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  const { id } = await params;
  const b = await prisma.autoBackup.findFirst({ where: { id, userId: uid }, select: { data: true, createdAt: true } });
  if (!b) return NextResponse.json({ error: "النسخة دي مش موجودة." }, { status: 404 });
  return new Response(new Uint8Array(gunzipSync(b.data)), {
    headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="daftar-backup-${dayKey(b.createdAt)}.json"`, "cache-control": "private, no-store" },
  });
}
