import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { recentMail } from "@/lib/gmail";

export const maxDuration = 30;

export async function GET() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  try {
    const mails = await recentMail(uid);
    if (mails === null) return NextResponse.json({ error: "Gmail مش متوصّل." }, { status: 404 });
    if (mails === "reconnect") return NextResponse.json({ reconnect: true, error: "Google قفل الوصول. اربط Gmail تاني." }, { status: 409 });
    return NextResponse.json({ mails });
  } catch (e) {
    console.error("gmail messages", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Gmail مش بيرد دلوقتي. جرّب كمان شوية." }, { status: 502 });
  }
}
