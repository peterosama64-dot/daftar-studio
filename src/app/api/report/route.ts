import { NextResponse } from "next/server";
import { writeReport, aiEnabled } from "@/lib/ai";
import { loadMonth } from "@/lib/data";
import { isMonthKey } from "@/lib/dates";
import { reportFacts } from "@/lib/report";

export async function POST(req: Request) {
  if (!aiEnabled()) return NextResponse.json({ error: "التقرير المكتوب محتاج ANTHROPIC_API_KEY في إعدادات السيرفر." }, { status: 501 });
  const { month } = (await req.json().catch(() => ({}))) as { month?: string };
  if (!isMonthKey(month)) return NextResponse.json({ error: "شهر غلط." }, { status: 400 });
  const text = await writeReport(reportFacts(month, await loadMonth(month)));
  if (!text) return NextResponse.json({ error: "ما عرفتش أكتب التقرير دلوقتي. جرّب كمان شوية." }, { status: 502 });
  return NextResponse.json({ text });
}
