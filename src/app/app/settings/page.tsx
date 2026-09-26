import { PageHead } from "@/components/month";
import Link from "next/link";
import { Button, Card, Field, Pill, btnClass, inputClass } from "@/components/ui";
import { CURRENCIES } from "@/lib/constants";
import { getCurrency, prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { logout } from "@/app/(auth)/actions";
import { aiEnabled, aiName } from "@/lib/ai";
import { isAdmin } from "@/lib/admin";
import { setCurrency, deleteEverything } from "../actions";

export const metadata = { title: "الإعدادات" };

export default async function Settings() {
  const uid = await requireUser();
  const [cur, user, admin, gmail] = await Promise.all([getCurrency(uid), prisma.user.findUnique({ where: { id: uid }, select: { email: true, name: true } }), isAdmin(uid), prisma.gmailAccount.findUnique({ where: { userId: uid }, select: { id: true } })]);
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
          <h2 className="text-lg font-bold">الربط</h2>
          {row("الترتيب الذكي", "بيحوّل كلامك ورسايل العملاء لمهام ومبالغ، ويكتب تقرير الشهر.", aiEnabled() ? <Pill tone="money">{`شغال · ${aiName()}`}</Pill> : <Pill tone="waiting">مش متفعّل</Pill>)}
          {row("Gmail", "قراءة الإيميلات وإيصالات الاشتراكات، من صفحة «الرسايل».", gmail ? <Pill tone="money">متوصّل</Pill> : <Link href="/app/inbox" className={btnClass("secondary", true)}>اربطه</Link>)}
          {row("واتساب", "مفيش ربط مباشر. صدّر الشات والزقه في «الرسايل».", <Pill>يدوي</Pill>)}
        </Card>
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
