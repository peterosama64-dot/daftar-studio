import { Capture } from "@/components/capture";
import { PageHead } from "@/components/month";
import { Card } from "@/components/ui";

export const metadata = { title: "الرسايل" };

export default function Inbox() {
  return (
    <>
      <PageHead title="الرسايل" base="/app/inbox" sub="طلّع الشغل والمبالغ من شات العملاء والإيميل" />
      <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Capture source="chat" compact title="واتساب أو أي شات" />
        <Card className="grid gap-3 p-5">
          <h2 className="text-lg font-bold">Gmail</h2>
          <p className="text-sm text-ink2">قراءة الإيميل وإيصالات الاشتراكات جاية في المرحلة الجاية: هتوصّل Gmail مرة واحدة، وتعلّم على الرسايل اللي فيها شغل، والدفتر يطلّع منها المهام والمبالغ.</p>
          <p className="text-sm text-muted">لحد ما ده يجهز: افتح الإيميل، انسخ نصه، والزقه في خانة الشات هنا.</p>
          <div className="rounded-xl border border-dashed border-rule p-4 text-sm">
            <b className="font-semibold">إزاي تصدّر شات واتساب؟</b>
            <ol className="mt-1.5 list-inside list-decimal text-muted">
              <li>افتح المحادثة ← النقط التلاتة ← المزيد ← تصدير الدردشة.</li>
              <li>اختار «بدون وسائط».</li>
              <li>افتح الملف، انسخ الجزء المهم والزقه هنا.</li>
            </ol>
          </div>
        </Card>
      </div>
    </>
  );
}
