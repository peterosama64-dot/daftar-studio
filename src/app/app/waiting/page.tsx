import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { now, shortDate } from "@/lib/dates";
import { whatsappLink } from "@/lib/contact";
import { loadWaiting } from "@/lib/waiting-data";
import { WAIT_DAYS, WAIT_LABEL, waitingList, type Waiting } from "@/lib/waiting";
import { PageHead } from "@/components/month";
import { Empty, Pill, SectionHead } from "@/components/ui";
import { FollowUp } from "@/components/follow-up";

export const metadata = { title: "مستني رد" };

const ago = (n: number) => (n === 0 ? "النهارده" : n === 1 ? "من امبارح" : n === 2 ? "من يومين" : n <= 10 ? `من ${n} أيام` : `من ${n} يوم`);

export default async function WaitingPage() {
  const uid = await requireUser();
  const today = now();
  const [items, user, clients] = await Promise.all([
    loadWaiting(uid),
    prisma.user.findUnique({ where: { id: uid }, select: { name: true } }),
    prisma.clientInfo.findMany({ where: { userId: uid }, select: { name: true, phone: true } }),
  ]);
  const phone = new Map(clients.map((c) => [c.name, c.phone ? whatsappLink(c.phone) : null]));
  const list = waitingList(items, today);
  const late = list.filter((w) => w.days >= WAIT_DAYS), fresh = list.filter((w) => w.days < WAIT_DAYS);

  const card = (w: Waiting) => (
    <li key={w.kind + w.id} className={`grid gap-2 rounded-xl border bg-sheet p-3 ${w.days >= WAIT_DAYS ? "border-wait" : "border-rule"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={w.href} className="min-w-0 flex-1 font-semibold hover:text-cyan [overflow-wrap:anywhere]">{w.title}{w.client ? <span className="font-normal text-muted"> · {w.client}</span> : null}</Link>
        <Pill>{WAIT_LABEL[w.kind]}</Pill>
        <Pill tone={w.days >= WAIT_DAYS ? "waiting" : "neutral"}>{w.nudgedAt && w.nudgedAt > w.since ? `تابعت ${ago(w.days)}` : `اتبعت ${ago(w.days)}`}</Pill>
      </div>
      {w.nudgedAt && w.nudgedAt > w.since && <p className="text-xs text-muted">اتبعت أول مرة <span className="num">{shortDate(w.since)}</span></p>}
      <FollowUp kind={w.kind} id={w.id} title={w.title} client={w.client} link={w.link} phone={phone.get(w.client) ?? null} sender={user?.name ?? ""} />
    </li>
  );

  return (
    <>
      <PageHead title="مستني رد" base="/app/waiting" sub={`شغل وعروض واتفاقات بعتها ولسه العميل مارّدش. بعد ${WAIT_DAYS} أيام هنفكّرك وتلاقي رسالة متابعة جاهزة.`} />
      <section aria-label="محتاج متابعة">
        <SectionHead title="محتاج متابعة" count={late.length} rule="risk" />
        {late.length ? <ul className="grid gap-2.5">{late.map(card)}</ul> : <Empty>مفيش حد متأخر في الرد. 👌</Empty>}
      </section>
      {fresh.length > 0 && (
        <section aria-label="لسه باعته">
          <SectionHead title="لسه باعته" count={fresh.length} />
          <ul className="grid gap-2.5">{fresh.map(card)}</ul>
        </section>
      )}
    </>
  );
}
