import { NextResponse } from "next/server";
import { z } from "zod";
import { parseText } from "@/lib/ai";
import { getCurrency } from "@/lib/db";
import { parsedCount } from "@/lib/parsed";

const Body = z.object({ text: z.string().min(1).max(40_000) });

// Simple per-instance limiter: 20 requests / minute per IP.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return NextResponse.json({ error: "طلبات كتير ورا بعض. استنى دقيقة وجرّب تاني." }, { status: 429 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "اكتب أو قول حاجة الأول." }, { status: 400 });
  const { data, via } = await parseText(body.data.text, await getCurrency());
  return NextResponse.json({ data, via, count: parsedCount(data) });
}
