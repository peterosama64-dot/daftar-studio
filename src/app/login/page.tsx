import Link from "next/link";
import { Brand, btnClass } from "@/components/ui";

export const metadata = { title: "الدخول" };

export default function Login() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="grid place-items-center px-4 py-12">
        <div className="grid w-full max-w-md gap-5">
          <Brand />
          <h1 className="text-[32px] font-extrabold">أهلاً بيك في الدفتر</h1>
          <p className="text-ink2">الحسابات لكل مستخدم جاية في المرحلة الجاية. دلوقتي الدفتر بيفتح على طول، ولو صاحب الموقع حاطط كلمة سر، المتصفح هيسألك عليها.</p>
          <Link href="/app" className={btnClass()}>ادخل الدفتر</Link>
          <Link href="/" className="text-sm text-cyan">رجوع للصفحة الرئيسية</Link>
        </div>
      </div>
      <div className="hidden place-items-center bg-sunken lg:grid">
        <div className="max-w-sm rounded-[20px] rounded-tr-sm border border-rule bg-sheet p-7 shadow-float">
          <p className="num mb-2 text-xs text-muted">REPORT · SEP 2026</p>
          <p className="leading-loose text-ink2">ابدأ بلوجو سُكّر، ميعاده بكرة. صافي ربحك <span className="num text-money">14,230</span> ج.م.</p>
        </div>
      </div>
    </div>
  );
}
