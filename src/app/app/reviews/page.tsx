import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { shortDate } from "@/lib/dates";
import { PageHead } from "@/components/month";
import { ShareBox } from "@/components/share-box";
import { Stars } from "@/components/stars";
import { Button, Card, Empty } from "@/components/ui";
import { setShowcase, shareReviews, unshareReviews } from "../actions";

export const metadata = { title: "آراء العملاء" };

export default async function Reviews() {
  const uid = await requireUser();
  const [list, user, waiting] = await Promise.all([
    prisma.task.findMany({ where: { userId: uid, rating: { not: null } }, orderBy: { ratedAt: "desc" }, select: { id: true, title: true, client: true, rating: true, ratingNote: true, ratedAt: true, showcase: true } }),
    prisma.user.findUnique({ where: { id: uid }, select: { reviewsToken: true } }),
    prisma.task.count({ where: { userId: uid, approvedAt: { not: null }, rating: null, reviewToken: { not: null } } }),
  ]);
  const avg = list.length ? list.reduce((s, t) => s + t.rating!, 0) / list.length : 0;
  const shown = list.filter((t) => t.showcase).length;
  return (
    <>
      <PageHead title="آراء العملاء" base="/app/reviews" sub="بعد ما العميل يوافق على التسليم من لينك المراجعة، بيقدر يقيّم الشغل" />
      {list.length > 0 && (
        <section className="grid grid-cols-3 gap-3" aria-label="الأرقام">
          <div className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3"><span className="text-[0.8125rem] text-muted">المتوسط</span><span className="num text-xl font-medium">{avg.toFixed(1)}</span><Stars n={Math.round(avg)} /></div>
          <div className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3"><span className="text-[0.8125rem] text-muted">تقييمات</span><span className="num text-xl font-medium">{list.length}</span></div>
          <div className="grid gap-0.5 rounded-xl border border-rule bg-sheet px-4 py-3"><span className="text-[0.8125rem] text-muted">معروضة للناس</span><span className="num text-xl font-medium">{shown}</span></div>
        </section>
      )}
      <Card className="grid gap-3 p-5">
        <h2 className="text-lg font-bold">صفحة آرائك</h2>
        <p className="text-sm text-muted">لينك عام فيه التقييمات اللي اخترت تعرضها بس — حطه في البايو أو ابعته لعميل جديد.</p>
        <ShareBox path={user?.reviewsToken ? `/s/w/${user.reviewsToken}` : null} what="آراء عملائك اللي اخترتها" make={shareReviews} revoke={unshareReviews} label="اعمل اللينك" />
      </Card>
      <Card className="p-5">
        <h2 className="mb-2 text-lg font-bold">التقييمات</h2>
        {list.length ? (
          <ul>
            {list.map((t) => (
              <li key={t.id} className="grid gap-1.5 border-b border-rule py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars n={t.rating!} />
                  <Link href={`/app/tasks/${t.id}`} className="min-w-0 flex-1 font-medium [overflow-wrap:anywhere] hover:text-cyan">{t.title}{t.client ? <span className="text-muted"> · {t.client}</span> : null}</Link>
                  {t.ratedAt && <span className="text-xs text-muted">{shortDate(t.ratedAt)}</span>}
                </div>
                {t.ratingNote && <p className="rounded-lg bg-paper px-3 py-2 text-sm [overflow-wrap:anywhere]">«{t.ratingNote}»</p>}
                <form action={setShowcase.bind(null, t.id, !t.showcase)}>
                  <Button kind={t.showcase ? "secondary" : "ghost"} small>{t.showcase ? "✓ معروض — شيله" : "اعرضه في صفحة آرائك"}</Button>
                </form>
              </li>
            ))}
          </ul>
        ) : <Empty>لسه مفيش تقييمات. ابعت للعميل لينك مراجعة التسليم من صفحة المهمة، وبعد ما يوافق هيقدر يقيّم.</Empty>}
        {waiting > 0 && <p className="mt-2 text-[0.8125rem] text-muted">{waiting} {waiting === 1 ? "عميل وافق" : "عملاء وافقوا"} على الشغل ولسه ماقيّموش.</p>}
      </Card>
    </>
  );
}
