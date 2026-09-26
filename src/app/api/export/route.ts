import { currentUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { currencyShort } from "@/lib/data";
import { dayKey, now } from "@/lib/dates";
import { exportSheets } from "@/lib/export";
import { buildXlsx } from "@/lib/xlsx";

// Everything the user has, as an Excel file (a backup, or something to hand an accountant).
export async function GET() {
  const uid = await currentUserId();
  if (!uid) return new Response("سجّل دخول الأول.", { status: 401 });
  const [tasks, entries, cur] = await Promise.all([
    prisma.task.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" } }),
    prisma.entry.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" } }),
    currencyShort(uid),
  ]);
  const file = buildXlsx(exportSheets(tasks, entries, cur.short));
  const name = `daftar-studio-${dayKey(now())}.xlsx`;
  return new Response(Buffer.from(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
