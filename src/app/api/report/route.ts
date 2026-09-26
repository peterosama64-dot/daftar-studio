import { NextResponse } from "next/server";
import { writeReport, aiEnabled } from "@/lib/ai";
import { loadMonth } from "@/lib/data";
import { isMonthKey } from "@/lib/dates";
import { reportFacts } from "@/lib/report";
import { currentUserId } from "@/lib/auth";

// Gemini may retry a busy model before answering.
export const maxDuration = 60;

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "التقرير المكتوب محتاج GEMINI_API_KEY أو ANTHROPIC_API_KEY في إعدادات السيرفر." }, { status: 501 });
  const { month } = (await req.json().catch(() => ({}))) as { month?: string };
  if (!isMonthKey(month)) return NextResponse.json({ error: "شهر غلط." }, { status: 400 });
  const text = await writeReport(reportFacts(month, await loadMonth(month, uid)));
  if (!text) return NextResponse.json({ error: "ما عرفتش أكتب التقرير دلوقتي. جرّب كمان شوية." }, { status: 502 });
  return NextResponse.json({ text });
}
