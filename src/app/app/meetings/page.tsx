import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AR_DAYS, clock, dayKey, daysUntil, now, shortDate, timeKey } from "@/lib/dates";
import { placeLink, REMIND_MINUTES } from "@/lib/meetings";
import { PageHead } from "@/components/month";
import { Button, Card, Empty, Field, Pill, SectionHead, inputClass } from "@/components/ui";
import { CalendarFeed } from "@/components/calendar-feed";
import { addMeeting, deleteMeeting, updateMeeting } from "../actions";

export const metadata = { title: "المواعيد" };

type M = Awaited<ReturnType<typeof prisma.meeting.findMany>>[number];

const dayLabel = (d: Date, today: Date) => {
  const n = daysUntil(d, today);
  return n === 0 ? "النهارده" : n === 1 ? "بكرة" : `${AR_DAYS[d.getDay()]} ${shortDate(d)}`;
};

export default async function Meetings() {
  const uid = await requireUser();
  const today = now();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const [upcoming, past, devices, clients, me] = await Promise.all([
    prisma.meeting.findMany({ where: { userId: uid, at: { gte: startOfToday } }, orderBy: { at: "asc" }, take: 200 }),
    prisma.meeting.findMany({ where: { userId: uid, at: { lt: startOfToday } }, orderBy: { at: "desc" }, take: 30 }),
    prisma.pushSubscription.count({ where: { userId: uid } }),
    prisma.clientInfo.findMany({ where: { userId: uid }, select: { name: true }, orderBy: { name: "asc" }, take: 300 }),
    prisma.user.findUnique({ where: { id: uid }, select: { calendarToken: true } }),
  ]);
  const byDay = new Map<string, M[]>();
  for (const m of upcoming) byDay.set(dayKey(m.at), [...(byDay.get(dayKey(m.at)) ?? []), m]);

  const row = (m: M, isPast = false) => {
    const link = placeLink(m.place);
    const gone = !isPast && m.at < today;
    return (
      <li key={m.id} className={`grid gap-2 rounded-xl border bg-sheet p-3 ${gone || isPast ? "border-rule opacity-70" : "border-rule"}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="shrink-0 font-semibold text-cyan"><span className="num">{clock(m.at).split(" ")[0]}</span> {clock(m.at).split(" ")[1]}</span>
          <span className="min-w-0 flex-1 font-semibold [overflow-wrap:anywhere]">{m.title}{m.client ? <span className="font-normal text-muted"> · {m.client}</span> : null}</span>
          {isPast && <span className="num text-xs text-muted">{shortDate(m.at)}</span>}
          {!isPast && m.remindedAt && <Pill>اتفكّرت</Pill>}
        </div>
        {(m.place || m.notes) && (
          <div className="grid gap-1 text-sm text-ink2">
            {link ? <a href={link} target="_blank" rel="noopener noreferrer" dir="ltr" className="justify-self-start truncate text-cyan [max-width:100%]">{m.place}</a> : m.place ? <span className="[overflow-wrap:anywhere]">{m.place}</span> : null}
            {m.notes && <p className="whitespace-pre-line [overflow-wrap:anywhere]">{m.notes}</p>}
          </div>
        )}
        <details className="text-sm">
          <summary className="cursor-pointer text-cyan">عدّل</summary>
          <form action={updateMeeting.bind(null, m.id)} className="mt-2 grid gap-2">
            <input name="title" defaultValue={m.title} required maxLength={200} aria-label="الميعاد" className={inputClass} />
            <div className="grid grid-cols-2 gap-2">
              <input name="day" type="date" defaultValue={dayKey(m.at)} required aria-label="اليوم" className={inputClass} />
              <input name="time" type="time" defaultValue={timeKey(m.at)} required aria-label="الساعة" className={inputClass} />
            </div>
            <input name="client" defaultValue={m.client} list="meeting-clients" aria-label="العميل" placeholder="العميل" className={inputClass} />
            <input name="place" defaultValue={m.place} aria-label="المكان أو اللينك" placeholder="المكان أو لينك الاجتماع" className={inputClass} />
            <textarea name="notes" defaultValue={m.notes} rows={2} aria-label="ملاحظات" placeholder="ملاحظات" className={inputClass} />
            <Button kind="secondary" small className="justify-self-start">احفظ</Button>
          </form>
          <form action={deleteMeeting.bind(null, m.id)} className="mt-2"><button className="text-sm text-risk">امسح</button></form>
        </details>
      </li>
    );
  };

  return (
    <>
      <PageHead title="المواعيد" base="/app/meetings" sub={`مكالمات واجتماعات بالساعة، وهيوصلك تنبيه قبلها بساعة`} />
      {devices === 0 && (
        <p className="rounded-xl border border-wait bg-wait-soft px-4 py-3 text-sm">
          التنبيهات مش شغالة على أي جهاز، فمش هيوصلك تفكير قبل المواعيد. <Link href="/app/settings" className="font-semibold text-cyan">شغّلها من الإعدادات ‹</Link>
        </p>
      )}
      <datalist id="meeting-clients">{clients.map((c) => <option key={c.name} value={c.name} />)}</datalist>
      <div className="grid items-start gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label="الجاية" className="grid gap-4">
          {byDay.size ? [...byDay.entries()].map(([k, list]) => (
            <div key={k}>
              <SectionHead title={dayLabel(list[0].at, today)} count={list.length} rule={k === dayKey(today) ? "cyan" : "ink"} />
              <ul className="grid gap-2">{list.map((m) => row(m))}</ul>
            </div>
          )) : <Empty>مفيش مواعيد جاية. ضيف مكالمة أو اجتماع من هنا.</Empty>}
        </section>
        <Card className="p-5">
          <h2 className="mb-3 text-lg font-bold">ميعاد جديد</h2>
          <form action={addMeeting} className="grid gap-3">
            <Field label="إيه الميعاد"><input name="title" required maxLength={200} placeholder="مكالمة مع كافيه نون" className={inputClass} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="اليوم"><input name="day" type="date" required defaultValue={dayKey(today)} className={inputClass} /></Field>
              <Field label="الساعة"><input name="time" type="time" required className={inputClass} /></Field>
            </div>
            <Field label="العميل"><input name="client" list="meeting-clients" className={inputClass} /></Field>
            <Field label="المكان أو اللينك"><input name="place" placeholder="meet.google.com/… أو العنوان" className={inputClass} /></Field>
            <Field label="ملاحظات"><textarea name="notes" rows={2} className={inputClass} /></Field>
            <Button className="justify-self-start">ضيف</Button>
            <p className="text-xs text-muted">هيوصلك تنبيه قبل الميعاد بحوالي {REMIND_MINUTES === 60 ? "ساعة" : `${REMIND_MINUTES} دقيقة`}.</p>
          </form>
        </Card>
      </div>
      <CalendarFeed path={me?.calendarToken ? `/s/cal/${me.calendarToken}` : null} />
      {past.length > 0 && (
        <Card className="p-5">
          <details>
            <summary className="cursor-pointer text-lg font-bold">اللي فاتت ({past.length})</summary>
            <ul className="mt-3 grid gap-2">{past.map((m) => row(m, true))}</ul>
          </details>
        </Card>
      )}
    </>
  );
}
