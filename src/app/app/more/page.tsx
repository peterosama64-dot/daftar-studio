import Link from "next/link";
import { PageHead } from "@/components/month";
import { Card } from "@/components/ui";

const LINKS = [
  { href: "/app/calendar", title: "التقويم", desc: "كل مواعيد التسليم في الشهر" },
  { href: "/app/recurring", title: "شغل شهري", desc: "عملاء على باقة شهرية: المهمة بتتعمل لوحدها كل شهر" },
  { href: "/app/quotes", title: "عروض الأسعار", desc: "عرض سعر للعميل، ولما يوافق يبقى شغلانة" },
  { href: "/app/templates", title: "قوالب الشغل", desc: "الشغل اللي بيتكرر: سعره وخطواته جاهزين" },
  { href: "/app/inbox", title: "الرسايل", desc: "طلّع الشغل من شات العملاء" },
  { href: "/app/report", title: "تقرير الشهر", desc: "خلصت إيه، ولسه إيه، وصافي ربحك" },
  { href: "/app/clients", title: "العملاء", desc: "مين شغال معاك ومين لسه عليه فلوس" },
  { href: "/app/settings", title: "الإعدادات", desc: "العملة والربط والخصوصية" },
];

export default function More() {
  return (
    <>
      <PageHead title="المزيد" base="/app/more" />
      <Card className="grid">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="flex items-center justify-between gap-3 border-b border-rule px-4 py-4 last:border-b-0">
            <span><span className="block font-display font-semibold">{l.title}</span><span className="text-sm text-muted">{l.desc}</span></span>
            <span className="text-muted" aria-hidden="true">‹</span>
          </Link>
        ))}
      </Card>
    </>
  );
}
