import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/auth";
import { BackupSchema, backupCounts, restoreBackup } from "@/lib/backup";

// Vercel functions take bodies up to 4.5 MB.
const MAX = 4 * 1024 * 1024;

/**
 * Restore a backup file: «check» only reads it and says what's inside; «restore» (with the typed
 * confirmation) replaces everything in this account with it.
 */
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "اختار ملف النسخة الاحتياطية." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ error: "الملف أكبر من ٤ ميجا." }, { status: 413 });
  let raw: unknown;
  try { raw = JSON.parse(await file.text()); } catch { return NextResponse.json({ error: "ده مش ملف نسخة احتياطية من الدفتر." }, { status: 400 }); }
  const parsed = BackupSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "الملف ده مش نسخة احتياطية سليمة من الدفتر." }, { status: 400 });
  const counts = backupCounts(parsed.data);
  if (form?.get("mode") !== "restore") return NextResponse.json({ ok: true, counts, exportedAt: (raw as { exportedAt?: string }).exportedAt ?? null });
  if (String(form.get("confirm") ?? "").trim() !== "استرجع") return NextResponse.json({ error: "اكتب «استرجع» عشان تأكد." }, { status: 400 });
  await restoreBackup(uid, parsed.data);
  revalidatePath("/app", "layout");
  return NextResponse.json({ ok: true, restored: counts });
}
