import { Capture } from "@/components/capture";
import { GmailPanel } from "@/components/gmail-panel";
import { PageHead } from "@/components/month";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { gmailConfigured } from "@/lib/gmail";

export const metadata = { title: "الرسايل" };

export default async function Inbox({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const uid = await requireUser();
  const [acc, { gmail }] = await Promise.all([prisma.gmailAccount.findUnique({ where: { userId: uid }, select: { email: true } }), searchParams]);
  return (
    <>
      <PageHead title="الرسايل" base="/app/inbox" sub="طلّع الشغل والمبالغ من شات العملاء والإيميل" />
      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        <GmailPanel email={acc ? acc.email || "متوصّل" : null} configured={gmailConfigured()} notice={gmail} />
        <div className="grid gap-5">
          <Capture source="chat" compact title="واتساب أو أي شات" />
          <Card className="rounded-xl p-4 text-sm">
            <b className="font-semibold">إزاي تصدّر شات واتساب؟</b>
            <ol className="mt-1.5 list-inside list-decimal text-muted">
              <li>افتح المحادثة ← النقط التلاتة ← المزيد ← تصدير الدردشة.</li>
              <li>اختار «بدون وسائط».</li>
              <li>افتح الملف، انسخ الجزء المهم والزقه هنا.</li>
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
