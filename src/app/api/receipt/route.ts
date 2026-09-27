import { NextResponse } from "next/server";
import { aiEnabled, readReceipt } from "@/lib/ai";
import { getCurrency } from "@/lib/db";
import { currentUserId } from "@/lib/auth";
import { MAX_FILE, sniffType } from "@/lib/revisions";
import { parseDay } from "@/lib/dates";

// Gemini may retry a busy model before answering.
export const maxDuration = 60;

// Simple per-instance limiter: 15 photos / minute per user.
const hits = new Map<string, number[]>();
function limited(key: string) {
  const t = Date.now();
  const recent = (hits.get(key) ?? []).filter((x) => t - x < 60_000);
  recent.push(t);
  hits.set(key, recent);
  return recent.length > 15;
}

/** Reads a receipt photo and suggests an expense. Nothing is saved here: the user checks the numbers and saves. */
export async function POST(req: Request) {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  if (!aiEnabled()) return NextResponse.json({ error: "قراءة الإيصالات محتاجة الذكاء الاصطناعي يكون متفعّل." }, { status: 503 });
  if (limited(uid)) return NextResponse.json({ error: "صور كتير ورا بعض. استنى دقيقة وجرّب تاني." }, { status: 429 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "اختار صورة الإيصال." }, { status: 400 });
  if (file.size > MAX_FILE) return NextResponse.json({ error: "الصورة كبيرة أوي." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const type = sniffType(bytes);
  if (!type || !/^image\/(jpeg|png|webp)$/.test(type)) return NextResponse.json({ error: "ابعت صورة (JPG أو PNG)." }, { status: 415 });
  const currency = await getCurrency(uid);
  const r = await readReceipt(bytes, type, currency);
  if (!r) return NextResponse.json({ found: false });
  const foreign = r.currency && r.currency.toUpperCase() !== currency.toUpperCase();
  return NextResponse.json({
    found: true,
    name: (foreign ? `${r.name} (${r.currency.toUpperCase()})` : r.name).slice(0, 120),
    amount: Math.round(r.amount * 100) / 100,
    date: parseDay(r.date) ? r.date : "",
    category: r.category ?? "",
  });
}
