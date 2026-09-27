import { PageHead } from "@/components/month";
import Link from "next/link";
import { Button, Card, Field, Pill, btnClass, inputClass } from "@/components/ui";
import { CURRENCIES } from "@/lib/constants";
import { getCurrency, prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";
import { aiEnabled, aiName } from "@/lib/ai";
import { isAdmin } from "@/lib/admin";
import { NotifyCard } from "@/components/notify-card";
import { LogoUpload } from "@/components/logo-upload";
import { BackupCard } from "@/components/backup-card";
import { AppearanceCard } from "@/components/appearance-card";
import { WeeklyEmailCard } from "@/components/weekly-email-card";
import { mailConfigured } from "@/lib/mail";
import { setCurrency, setName, setRates, deleteEverything } from "../actions";
import { parseRates } from "@/lib/fx";

export const metadata = { title: "الإعدادات" };

export default async function Settings() {
  const uid = await requireUser();
  const [cur, user, admin, gmail] = await Promise.all([getCurrency(uid), prisma.user.findUnique({ where: { id: uid }, select: { email: true, name: true, weeklyEmail: true, fxRates: true, logoUrl: true, bizPhone: true, bizAddress: true, payInfo: true } }), isAdmin(uid), prisma.gmailAccount.findUnique({ where: { userId: uid }, select: { id: true } })]);
  const row = (name: string, desc: string, right: React.ReactNode) => (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-4 last:border-b-0">
      <div className="min-w-0"><div className="font-display font-semibold">{name}</div><p className="text-sm text-muted">{desc}</p></div>
      {right}
    </div>
  );
  return (
    <>
      <PageHead title="الإعدادات" base="/app/settings" />
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-1 text-lg font-bold">الحساب</h2>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted">{user?.name ? `${user.name} · ` : ""}<span dir="ltr">{user?.email}</span></p>
            <div className="flex flex-wrap gap-2">
              {admin && <Link href="/app/admin" className={btnClass("secondary", true)}>لوحة الأدمن</Link>}
              <form action={logout}><Button kind="secondary" small>اخرج</Button></form>
            </div>
          </div>
        </Card>
        <Card className="p-5 lg:row-span-2">
          <h2 className="mb-1 text-lg font-bold">بياناتك على الفواتير</h2>
          <p className="mb-3 text-sm text-muted">بتظهر على الفواتير وعروض الأسعار ولينكات العملاء.</p>
          <div className="grid gap-4">
            <LogoUpload url={user?.logoUrl ?? null} />
            <form action={setName} className="grid gap-3">
              <Field label="اسمك أو اسم الاستوديو"><input name="name" defaultValue={user?.name ?? ""} maxLength={80} className={inputClass} /></Field>
              <Field label="رقم التليفون"><input name="bizPhone" dir="ltr" defaultValue={user?.bizPhone ?? ""} maxLength={40} placeholder="01xxxxxxxxx" className={`${inputClass} text-left`} /></Field>
              <Field label="العنوان"><input name="bizAddress" defaultValue={user?.bizAddress ?? ""} maxLength={200} placeholder="القاهرة، مصر الجديدة" className={inputClass} /></Field>
              <Field label="طرق الدفع"><textarea name="payInfo" rows={3} defaultValue={user?.payInfo ?? ""} maxLength={600} placeholder={"InstaPay: name@instapay\nفودافون كاش: 010xxxxxxxx\nحساب بنكي: …"} className={inputClass} /></Field>
              <Button small className="justify-self-start">احفظ</Button>
            </form>
          </div>
        </Card>
        <Card className="p-5">
          <h2 className="mb-2 text-lg font-bold">العملة</h2>
          <form action={setCurrency} className="flex flex-wrap items-end gap-2">
            <Field label="كل المبالغ هتتعرض بـ">
              <select name="currency" defaultValue={cur} className={inputClass}>
                {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.label} ({c.short})</option>)}
              </select>
            </Field>
            <Button small>احفظ</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-bold">أسعار الصرف</h2>
          <p className="mb-3 text-sm text-muted">لو بتشتغل بعملة تانية: حط سعرها، وتقدر تختارها في المهمة أو عرض السعر أو الدخل. كل التقارير بتتحسب بعملتك الأساسية.</p>
          <form action={setRates} className="grid gap-3">
            {CURRENCIES.filter((c) => c.code !== cur).map((c) => (
              <label key={c.code} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-24">١ {c.label}</span><span className="text-muted">=</span>
                <input name={`rate_${c.code}`} inputMode="decimal" defaultValue={parseRates(user?.fxRates)[c.code] ?? ""} placeholder="—" aria-label={`سعر ${c.label}`} className={`${inputClass} num w-28 text-left`} />
                <span className="text-muted">{CURRENCIES.find((x) => x.code === cur)?.short}</span>
              </label>
            ))}
            <Button small className="justify-self-start">احفظ الأسعار</Button>
          </form>
        </Card>
        <Card className="p-5">
          <h2 className="text-lg font-bold">الربط</h2>
          {row("الترتيب الذكي", "بيحوّل كلامك ورسايل العملاء لمهام ومبالغ، ويكتب تقرير الشهر.", aiEnabled() ? <Pill tone="money">{`شغال · ${aiName()}`}</Pill> : <Pill tone="waiting">مش متفعّل</Pill>)}
          {row("Gmail", "قراءة الإيميلات وإيصالات الاشتراكات، من صفحة «الرسايل».", gmail ? <Pill tone="money">متوصّل</Pill> : <Link href="/app/inbox" className={btnClass("secondary", true)}>اربطه</Link>)}
          {row("واتساب", "مفيش ربط مباشر. صدّر الشات والزقه في «الرسايل».", <Pill>يدوي</Pill>)}
        </Card>
        <AppearanceCard />
        <NotifyCard />
        <WeeklyEmailCard on={!!user?.weeklyEmail} configured={mailConfigured()} email={user?.email ?? ""} />
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">نسخة Excel</h2>
          <p className="mb-3 text-sm text-muted">كل شغلك وفلوسك واشتراكاتك في ملف واحد، تفتحه بـ Excel أو Google Sheets. خليه نسخة احتياطية أو ابعته للمحاسب.</p>
          <a href="/api/export" download className={btnClass("secondary", true)}>نزّل ملف Excel</a>
        </Card>
        <BackupCard />
        <Card className="p-5 lg:col-span-2">
          <h2 className="text-lg font-bold">امسح كل بياناتي</h2>
          <p className="mb-3 text-sm text-muted">بيمسح كل المهام والفلوس. المسح نهائي ومش بيرجع. اكتب «امسح» في الخانة عشان تأكد.</p>
          <form action={deleteEverything} className="flex flex-wrap items-end gap-2">
            <input name="confirm" placeholder="امسح" className={`${inputClass} max-w-40`} aria-label="اكتب امسح للتأكيد" />
            <Button kind="danger" small>امسح كل حاجة</Button>
          </form>
        </Card>
      </div>
    </>
  );
}
