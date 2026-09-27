import { PageHead } from "@/components/month";
import { Button, Card, Pill, inputClass } from "@/components/ui";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { adminStats, humanBytes, lastSeen } from "@/lib/admin-stats";
import { adminDeleteUser, adminSetPassword, adminSetSuspended } from "./actions";

export const metadata = { title: "لوحة الأدمن" };

const day = (d: Date) => d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "short", year: "numeric", timeZone: process.env.APP_TIMEZONE || "Africa/Cairo" });

// Accounts only: who signed up and how much they use it. The admin never sees
// anyone's tasks, clients or amounts.
export default async function Admin() {
  const me = await requireAdmin();
  const [rows, files] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, name: true, createdAt: true, lastSeenAt: true, suspendedAt: true, _count: { select: { tasks: true, entries: true } } },
    }),
    prisma.delivery.groupBy({ by: ["userId"], _count: { _all: true }, _sum: { size: true } }),
  ]);
  const byUser = new Map(files.map((f) => [f.userId, { files: f._count._all, bytes: f._sum.size ?? 0 }]));
  const users = rows.map((u) => ({ ...u, tasks: u._count.tasks, entries: u._count.entries, files: 0, bytes: 0, ...byUser.get(u.id) }));
  const at = new Date();
  const s = adminStats(users, at);
  const stats: [string, string][] = [
    ["حسابات", String(s.users)],
    ["جداد آخر ٣٠ يوم", String(s.new30)],
    ["فتحوا النهارده", String(s.active1)],
    ["فتحوا آخر ٧ أيام", String(s.active7)],
    ["مهام", s.tasks.toLocaleString("en")],
    ["حركات فلوس", s.entries.toLocaleString("en")],
    ["ملفات متسلّمة", s.files.toLocaleString("en")],
    ["مساحة الملفات", humanBytes(s.bytes)],
  ];
  return (
    <>
      <PageHead title="لوحة الأدمن" base="/app/admin" />
      <div className="grid gap-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="أرقام عامة">
          {stats.map(([l, n]) => (
            <div key={l} className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3">
              <span className="text-[13px] text-muted">{l}</span>
              <span dir="ltr" className="num text-xl font-medium text-right">{n}</span>
            </div>
          ))}
        </section>
        {s.suspended > 0 && <p className="text-sm text-risk">{s.suspended} حساب متوقّف.</p>}
        <Card className="p-5">
          <h2 className="mb-1 text-lg font-bold">الحسابات</h2>
          <p className="mb-2 text-sm text-muted">لو حد نسي كلمة السر، اكتبله واحدة جديدة وابعتهاله. «وقّف الحساب» بيقفل الدخول والتذكيرات ولينكات العملاء من غير ما يمسح حاجة، وتقدر ترجّعه. المسح نهائي وبيمسح كل بيانات الحساب.</p>
          {users.map((u) => (
            <div key={u.id} className="grid gap-3 border-b border-rule py-4 last:border-b-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold">{u.name || "من غير اسم"}</span>
                <span dir="ltr" className="text-sm text-ink2">{u.email}</span>
                {u.id === me && <Pill tone="later">إنت</Pill>}
                {u.suspendedAt && <Pill tone="urgent">متوقّف</Pill>}
              </div>
              <div className="text-sm text-muted">
                اشترك {day(u.createdAt)} · آخر مرة فتح: {lastSeen(u.lastSeenAt, at)} · <span className="font-mono">{u.tasks}</span> مهمة · <span className="font-mono">{u.entries}</span> حركة{u.files > 0 && <> · <span className="font-mono">{u.files}</span> ملف (<bdi dir="ltr">{humanBytes(u.bytes)}</bdi>)</>}
              </div>
              <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                <form action={adminSetPassword} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={u.id} />
                  <div className="w-52"><input name="password" type="text" minLength={8} required autoComplete="off" placeholder="كلمة سر جديدة" aria-label={`كلمة سر جديدة لـ ${u.email}`} className={inputClass} /></div>
                  <Button kind="secondary" small>غيّر كلمة السر</Button>
                </form>
                {u.id !== me && (
                  <form action={adminSetSuspended}>
                    <input type="hidden" name="id" value={u.id} />
                    <input type="hidden" name="on" value={u.suspendedAt ? "0" : "1"} />
                    <Button kind="secondary" small>{u.suspendedAt ? "رجّع الحساب" : "وقّف الحساب"}</Button>
                  </form>
                )}
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
