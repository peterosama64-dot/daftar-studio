import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/site";
import { MicIcon, Pill, btnClass } from "@/components/ui";

import { AR_DAYS as DAYS, now } from "@/lib/dates";

export const revalidate = 600;

function Head({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10 grid items-end gap-6 md:grid-cols-[1fr_1.3fr]">
      <h2 className="text-[clamp(28px,4.2vw,46px)] font-bold leading-tight">{title}</h2>
      <p className="max-w-[56ch] text-ink2">{children}</p>
    </div>
  );
}

export default function Landing() {
  const today = DAYS[now().getDay()];
  const items: [React.ComponentProps<typeof Pill>["tone"], string, string, string, string][] = [
    ["urgent", "مستعجل", "لوجو كافيه سُكّر", "الخميس", "text-muted"],
    ["money", "دخل", "كتالوج · مكتبة الكرمة", "+7,500", "text-money"],
    ["waiting", "اشتراك", "Figma · كل شهر", "−720", "text-risk"],
    ["later", "ليه وقت", "مود بورد عيادة بسمة", "30/9", "text-muted"],
  ];
  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-6">
      <SiteNav />
      <header className="grid items-center gap-12 pt-6 pb-20 lg:grid-cols-[1.25fr_1fr]">
        <div className="grid gap-5">
          <p className="num text-right text-xs tracking-[.14em] text-muted">FOR DESIGNERS &amp; ART DIRECTORS</p>
          <h1 className="text-[clamp(38px,5.4vw,66px)] font-extrabold leading-[1.15]">
            قولها <span className="inline-grid h-[.8em] translate-y-[-.05em] place-items-center rounded-[.3em] bg-cyan px-[.3em] align-middle text-on-accent"><MicIcon className="size-[.48em]" /></span> بصوتك،
            <br />والدفتر يرتّب الشغل <span className="num inline-flex translate-y-[-.15em] items-center rounded-[.3em] bg-money-soft px-[.3em] align-middle text-[.42em] font-semibold text-money">+ج.م</span> والفلوس
          </h1>
          <p className="max-w-[46ch] text-[19px] text-ink2">سجّل مهامك ودخلك واشتراكاتك وانت ماشي. الدفتر بيطلّع الشغل من شات العملاء، وآخر الشهر يقولك خلصت إيه، والمستعجل إيه، وصافي ربحك كام.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/app" className={btnClass()}>افتح الدفتر ‹</Link>
            <span className="text-sm text-muted">شغال من الموبايل والكمبيوتر، وبالعربي المصري</span>
          </div>
        </div>
        <div className="grid gap-3 rounded-[20px] border border-rule bg-sheet p-5 shadow-float" aria-label="مثال: جملة بالصوت بتتحول لمهام وفلوس">
          <div className="num flex justify-between text-[11px] text-muted"><span>VOICE NOTE · 00:14</span><span>REV 03</span></div>
          <div className="flex items-start gap-3 rounded-2xl bg-paper p-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan text-on-accent"><MicIcon className="size-[18px]" /></span>
            <p className="text-[15px] leading-8 text-ink2">لازم أسلّم لوجو كافيه سُكّر الخميس ومستعجل، واستلمت ٧٥٠٠ من مكتبة الكرمة عن الكتالوج، وجددت فيجما بـ ٧٢٠، والمود بورد بتاع عيادة بسمة آخر الشهر.</p>
          </div>
          <p className="num text-center text-xs text-muted">↓ sorted</p>
          {items.map(([tone, tag, t, v, c]) => (
            <div key={t} className="flex items-center gap-2.5 rounded-xl border border-rule px-3 py-2.5">
              <Pill tone={tone}>{tag}</Pill><span className="flex-1 text-[15px]">{t}</span><span className={`num text-sm ${c}`}>{v}</span>
            </div>
          ))}
        </div>
      </header>

      <section id="how" className="border-t border-rule py-20">
        <Head title="من الكلام للدفتر في تلات خطوات">مش محتاج تفتح جدول ولا تختار من قوايم. اتكلم زي ما بتكلم صاحبك، والدفتر يفهم «بكرة» و«الخميس الجاي» و«٥ آلاف».</Head>
        <ol className="border-t-2 border-ink">
          {[
            ["01", "قول أو الزق", "سجّل بصوتك، أو الزق شات العميل من واتساب.", "«العميل عايز ٣ تعديلات على البوستر قبل السبت، والدفعة التانية ٤٠٠٠ بعد التسليم»"],
            ["02", "راجع واحفظ", "بتشوف اللي اتفهم قبل ما يتحفظ: مهمة بميعادها، ومبلغ تحت اسم العميل.", "مستعجل · تعديلات البوستر · السبت — متوقع · دفعة تانية · 4,000"],
            ["03", "اقرا تقرير الشهر", "خلصت إيه، واللي فاضل، وتبدأ بإيه النهارده، وصافي ربحك.", "«ابدأ بلوجو سُكّر، ميعاده بكرة. الاشتراكات واكلة ١٤٪ من دخلك.»"],
          ].map(([n, h, p, ex]) => (
            <li key={n} className="grid items-center gap-3 border-b border-dashed border-rule py-6 md:grid-cols-[100px_1fr_1.1fr] md:gap-7">
              <span className="num text-4xl font-bold text-cyan">{n}</span>
              <div><h3 className="mb-1 text-2xl font-bold">{h}</h3><p className="text-ink2">{p}</p></div>
              <p className="rounded-2xl border border-rule bg-sheet px-4 py-3.5 text-[15px] text-ink2">{ex}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="money" className="border-t border-rule py-20">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div className="grid gap-4">
            <p className="num text-right text-xs tracking-[.14em] text-muted">SEPTEMBER · EGP</p>
            <p className="font-display text-[clamp(22px,2.6vw,30px)] font-semibold leading-relaxed">دخلت كام، والاشتراكات أخدت كام، و<span className="text-risk">اللي فضل</span> في إيدك كام. من غير آلة حاسبة.</p>
            <p className="max-w-[52ch] text-ink2">الاشتراك بيتحسب لوحده كل شهر لحد ما توقفه. الدخل بيتسجّل باسم العميل، فتعرف مين اللي شايل الشهر.</p>
          </div>
          <div className="rounded-[20px] border border-rule bg-sheet p-7 shadow-float">
            {[["الدخل", "17,000", ""], ["الاشتراكات", "−2,170", "text-risk"], ["مصاريف تانية", "−600", "text-risk"]].map(([l, v, c]) => (
              <div key={l} className="flex justify-between border-b border-rule py-3"><span>{l}</span><span className={`num ${c}`}>{v}</span></div>
            ))}
            <div className="flex justify-between border-t-2 border-ink pt-4 font-display text-[22px] font-bold"><span>صافي الربح</span><span className="num text-money">14,230</span></div>
          </div>
        </div>
      </section>

      <section id="report" className="border-t border-rule py-20">
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.2fr]">
          <div><h2 className="mb-4 text-[clamp(28px,4.2vw,46px)] font-bold leading-tight">آخر الشهر، تقرير مكتوب بلغتك</h2><p className="text-ink2">مش جداول وبس. الدفتر بيكتبلك ملخص قصير بالعامية زي ما مدير أعمالك كان هيقولهولك.</p></div>
          <div className="max-w-[62ch] rounded-[20px] rounded-tr-sm border border-rule bg-sheet p-7 leading-loose text-ink2 shadow-float">
            <p className="num mb-2 text-xs text-muted">REPORT · SEP 2026</p>
            الشهر ده <b className="text-ink">خلصت ٥ حاجات</b>. فاضل ٤. <span className="font-semibold text-risk">ابدأ بلوجو سُكّر</span>، ميعاده بكرة. دخلك 17,000، والاشتراكات 2,170، فـ<span className="font-semibold text-money">صافي ربحك 14,230</span>.
          </div>
        </div>
      </section>

      <section className="grid items-center gap-6 rounded-3xl bg-ink p-8 text-paper sm:grid-cols-[auto_1fr] lg:p-11">
        <svg viewBox="0 0 24 24" className="size-14 text-cyan" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>
        <div><h2 className="mb-1.5 text-[clamp(24px,3vw,34px)] font-bold">دفترك ليك انت بس</h2><p className="max-w-[60ch] opacity-80">أرقامك ومهامك محفوظة على حسابك، ومحدش يشوفها غيرك.</p></div>
      </section>

      <section className="grid items-end gap-8 py-20 md:grid-cols-[1.3fr_auto]">
        <h2 className="text-[clamp(34px,5vw,60px)] font-extrabold leading-[1.15]">النهارده {today}.<br />تعرف الشغل اللي هيتسلّم بكرة؟</h2>
        <Link href="/app" className={btnClass()}>افتح الدفتر</Link>
      </section>
      <SiteFooter />
    </div>
  );
}
