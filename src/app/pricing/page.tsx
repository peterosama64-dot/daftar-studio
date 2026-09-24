import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/site";
import { Pill, btnClass } from "@/components/ui";

export const metadata = { title: "الأسعار" };

const FEATURES: [string, string, string][] = [
  ["تسجيل بالصوت وترتيب تلقائي", "✓", "✓"],
  ["بورد الشغل: مستعجل / ليه وقت / خلصته", "✓", "✓"],
  ["الدخل والاشتراكات وصافي الربح", "✓", "✓"],
  ["استيراد شات واتساب", "✓", "✓"],
  ["قراءة Gmail وإيصالات الاشتراكات", "—", "✓"],
  ["تقرير الشهر المكتوب", "—", "✓"],
];

export default function Pricing() {
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <SiteNav />
      <header className="grid items-end gap-6 pt-14 pb-12 md:grid-cols-[1fr_auto]">
        <h1 className="text-[clamp(36px,5.4vw,60px)] font-extrabold">ادفع على قد شغلك</h1>
        <p className="max-w-[46ch] text-lg text-ink2">ابدأ مجاناً. الأسعار النهائية لخطة الاستوديو هتتعلن قريب.</p>
      </header>
      <div className="grid items-start gap-5 md:grid-cols-[1fr_1.2fr]">
        {[
          { name: "مجاني", price: "0", desc: "كل اللي تحتاجه عشان تبدأ تنظّم شغلك وفلوسك.", hl: false },
          { name: "استوديو", price: "قريباً", desc: "كل حاجة، وقراءة Gmail، وتقرير الشهر المكتوب.", hl: true },
        ].map((p) => (
          <div key={p.name} className={`grid gap-3.5 rounded-[20px] bg-sheet p-8 ${p.hl ? "border-2 border-ink shadow-float" : "border border-rule"}`}>
            <div className="flex items-center gap-2.5"><h2 className="text-2xl font-bold">{p.name}</h2>{p.hl && <Pill tone="later">الأنسب لو شغال مع عملاء كتير</Pill>}</div>
            <div className="flex items-baseline gap-2">{p.price === "قريباً" ? <span className="font-display text-3xl font-bold">قريباً</span> : <><span className="num text-4xl font-bold">{p.price}</span><span className="text-muted">ج.م / شهر</span></>}</div>
            <p className="text-ink2">{p.desc}</p>
            <Link href="/signup" className={btnClass(p.hl ? "primary" : "secondary")}>{p.hl ? "ابدأ مجاناً" : "ابدأ"}</Link>
          </div>
        ))}
      </div>
      <section className="pt-16">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px]">
            <thead><tr className="border-b-2 border-ink text-sm text-muted"><th className="py-3 text-right font-display text-lg font-bold text-ink">المقارنة</th><th className="w-28 font-normal">مجاني</th><th className="w-28 font-normal">استوديو</th></tr></thead>
            <tbody>{FEATURES.map(([f, a, b]) => <tr key={f} className="border-b border-rule"><td className="py-3">{f}</td><td className="num text-center text-muted">{a}</td><td className="num text-center">{b}</td></tr>)}</tbody>
          </table>
        </div>
      </section>
      <section className="grid gap-3 py-16">
        <h2 className="text-3xl font-bold">أسئلة بتتسأل كتير</h2>
        {[
          ["بياناتي بتروح فين؟", "على حسابك في الدفتر بس. الكلام اللي بتقوله بيتبعت لـ Claude عشان يترتّب، ومش بيتخزن عنده."],
          ["بيفهم العامية المصري؟", "أيوه. «بكرة» و«الخميس الجاي» و«٥ آلاف» كلها بتتفهم."],
          ["ينفع أستخدمه من الموبايل؟", "أيوه، الموقع معمول للموبايل الأول، والمايك شغال من Chrome."],
        ].map(([q, a]) => (
          <details key={q} className="border-b border-rule py-4"><summary className="cursor-pointer font-display text-lg font-semibold">{q}</summary><p className="mt-2 text-ink2">{a}</p></details>
        ))}
      </section>
      <SiteFooter />
    </div>
  );
}
