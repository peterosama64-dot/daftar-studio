import { PageHead } from "@/components/month";
import { Button, Card, Pill, inputClass } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { adminDeleteUser, adminSetPassword } from "./actions";

export const metadata = { title: "لوحة الأدمن" };

const day = (d: Date) => d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric", timeZone: process.env.APP_TIMEZONE || "Africa/Cairo" });

// Accounts only: who signed up and how much they use it. The admin never sees
// anyone's tasks, clients or amounts.
export default async function Admin() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, createdAt: true, _count: { select: { tasks: true, entries: true } } },
  });
  const tasks = users.reduce((s, u) => s + u._count.tasks, 0);
  const entries = users.reduce((s, u) => s + u._count.entries, 0);
  return (
    <>
      <PageHead title="لوحة الأدمن" base="/app/admin" />
      <div className="grid gap-5">
        <Card className="flex flex-wrap gap-8 p-5">
          {[["حسابات", users.length], ["مهام", tasks], ["حركات فلوس", entries]].map(([l, n]) => (
            <div key={l as string}><div className="font-mono text-2xl font-semibold">{(n as number).toLocaleString("en")}</div><div className="text-sm text-muted">{l}</div></div>
          ))}
        </Card>
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-bold">الحسابات</h2>
          <p className="mb-2 text-sm text-muted">لو حد نسي كلمة السر، اكتبله واحدة جديدة وابعتهاله. المسح نهائي وبيمسح كل بيانات الحساب.</p>
          {users.map((u) => (
            <div key={u.id} className="grid gap-3 border-b border-rule py-4 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold">{u.name || "من غير اسم"}</span>
                <span dir="ltr" className="text-sm text-ink2">{u.email}</span>
                {u.id === me && <Pill tone="later">إنت</Pill>}
                <span className="text-sm text-muted">· من {day(u.createdAt)} · <span className="font-mono">{u._count.tasks}</span> مهمة · <span className="font-mono">{u._count.entries}</span> حركة</span>
              </div>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <form action={adminSetPassword} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <div className="w-52"><input name="password" type="text" minLength={8} required autoComplete="off" placeholder="كلمة سر جديدة" aria-label={`كلمة سر جديدة لـ ${u.email}`} className={inputClass} /></div>
                  <Button kind="secondary" small>غيّر كلمة السر</Button>
                </form>
                {u.id !== me && (
                  <form action={adminDeleteUser} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="id" value={u.id} />
                    <div className="w-24"><input name="confirm" placeholder="امسح" aria-label={`اكتب امسح لتأكيد مسح ${u.email}`} className={inputClass} /></div>
                    <Button kind="danger" small>امسح الحساب</Button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </Card>
      </div>
    </>
  );
}
