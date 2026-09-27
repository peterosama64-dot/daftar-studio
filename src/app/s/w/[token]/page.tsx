/* eslint-disable @next/next/no-img-element -- the owner's logo comes from Blob storage */
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isToken } from "@/lib/share";
import { Stars } from "@/components/stars";
import { Card } from "@/components/ui";

export const metadata = { title: "آراء العملاء" };

/** Public: only the reviews the owner chose to show; client names shortened to a first name. */
export default async function PublicReviews({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!isToken(token)) notFound();
  const u = await prisma.user.findUnique({ where: { reviewsToken: token, suspendedAt: null }, select: { id: true, name: true, email: true, logoUrl: true } });
  if (!u) notFound();
  const list = await prisma.task.findMany({ where: { userId: u.id, showcase: true, rating: { not: null } }, orderBy: { ratedAt: "desc" }, take: 50, select: { id: true, title: true, client: true, rating: true, ratingNote: true } });
  const avg = list.length ? list.reduce((s, t) => s + t.rating!, 0) / list.length : 0;
  return (
    <>
      <header className="grid justify-items-center gap-2 text-center">
        {u.logoUrl && <img src={u.logoUrl} alt="" className="max-h-16 max-w-40 object-contain" />}
        <h1 className="text-2xl font-bold">آراء عملاء {u.name || "المصمم"}</h1>
        {list.length > 0 && <p className="flex items-center gap-2 text-sm text-muted"><Stars n={Math.round(avg)} /> <span className="num">{avg.toFixed(1)}</span> من {list.length} {list.length === 1 ? "تقييم" : "تقييمات"}</p>}
      </header>
      {list.length ? (
        <div className="grid gap-3">
          {list.map((t) => (
            <Card key={t.id} className="grid gap-2 p-5">
              <Stars n={t.rating!} />
              {t.ratingNote && <p className="text-[0.9375rem] leading-7 [overflow-wrap:anywhere]">«{t.ratingNote}»</p>}
              <p className="text-sm text-muted">{t.client ? t.client.split(/\s+/)[0] : "عميل"} · {t.title}</p>
            </Card>
          ))}
        </div>
      ) : <p className="text-center text-muted">لسه مفيش آراء معروضة.</p>}
    </>
  );
}
