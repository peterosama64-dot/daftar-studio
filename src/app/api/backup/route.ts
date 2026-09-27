import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { buildBackup } from "@/lib/backup";
import { dayKey, now } from "@/lib/dates";

/** Download the whole notebook as one JSON file (restorable from settings). */
export async function GET() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  const body = JSON.stringify(await buildBackup(uid));
  return new NextResponse(body, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="daftar-backup-${dayKey(now())}.json"`,
      "cache-control": "no-store",
    },
  });
}
