import { NextResponse } from "next/server";
import { z } from "zod";
import { parseText } from "@/lib/ai";
import { getCurrency } from "@/lib/db";
import { currentUserId } from "@/lib/auth";
import { parsedCount } from "@/lib/parsed";

// Gemini may retry a busy model before answering.
export const maxDuration = 60;

const Body = z.object({ text: z.string().min(1).max(40_000) });

// Simple per-instance limiter: 20 requests / minute per user.
const hits = new Map<string, number[]>();
function limited(key: string) {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > 20;
}

export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  if (limited(uid)) return NextResponse.json({ error: "طلبات كتير ورا بعض. استنى دقيقة وجرّب تاني." }, { status: 429 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "اكتب أو قول حاجة الأول." }, { status: 400 });
  const { data, via } = await parseText(body.data.text, await getCurrency(uid));
  return NextResponse.json({ data, via, count: parsedCount(data) });
}
