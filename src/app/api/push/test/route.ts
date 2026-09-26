import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/auth";
import { pushToUser } from "@/lib/push";

export async function POST() {
  const uid = await currentUserId();
  if (!uid) return NextResponse.json({ error: "سجّل دخول الأول." }, { status: 401 });
  const { devices, sent } = await pushToUser(uid, { title: "دفتر الاستوديو", body: "التنبيهات شغالة ✓ هتوصلك كل يوم الصبح لو فيه مواعيد.", url: "/app/tasks" });
  if (!devices) return NextResponse.json({ error: "مفيش جهاز مفعّل عليه التنبيهات." }, { status: 404 });
  if (!sent) return NextResponse.json({ error: "ما وصلش. دوس «وقّفها» وبعدين «فعّل» تاني." }, { status: 502 });
  return NextResponse.json({ sent });
}
