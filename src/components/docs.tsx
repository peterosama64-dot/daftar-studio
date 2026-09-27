import type { ReactNode } from "react";
import { fmt } from "@/lib/money";
import type { QuoteItem } from "@/lib/quote";
import type { Party } from "@/lib/party";
import { Brand, Card } from "./ui";

// The invoice and quote as documents, shared by the owner's pages and the public client links.

const longDate = (d: Date) => d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });


function Shell({ children }: { children: ReactNode }) {
  return (
    <Card className="mx-auto grid w-full max-w-2xl gap-6 p-6 lg:p-9 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0">{children}</Card>
  );
}

function Parties({ from, to }: { from: Party; to: string }) {
  return (
    <section className="grid gap-5 sm:grid-cols-2 print:grid-cols-2">
      <div className="grid gap-1">
        <span className="text-xs text-muted">من</span>
        <span className="font-display text-lg font-bold">{from.name || from.email}</span>
        {from.name && <span dir="ltr" className="text-right text-sm text-ink2">{from.email}</span>}
        {from.bizPhone && <span dir="ltr" className="text-right text-sm text-ink2">{from.bizPhone}</span>}
        {from.bizAddress && <span className="whitespace-pre-line text-sm text-ink2">{from.bizAddress}</span>}
      </div>
      <div className="grid gap-1">
        <span className="text-xs text-muted">إلى</span>
        <span className="font-display text-lg font-bold">{to || "—"}</span>
      </div>
    </section>
  );
}

/* eslint-disable @next/next/no-img-element -- the owner's logo comes from Blob storage */
function Logo({ from }: { from: Party }) {
  return from.logoUrl ? <img src={from.logoUrl} alt={from.name || "اللوجو"} className="max-h-16 max-w-40 object-contain" /> : null;
}

/** How to pay, as the owner wrote it (InstaPay, wallet, bank…). */
function PayInfo({ from }: { from: Party }) {
  if (!from.payInfo) return null;
  return (
    <section className="rounded-xl border border-rule bg-paper p-4 text-sm print:bg-white">
      <p className="mb-1 font-semibold">طرق الدفع</p>
      <p className="whitespace-pre-line text-ink2 [overflow-wrap:anywhere]">{from.payInfo}</p>
    </section>
  );
}

function Footer({ line }: { line: string }) {
  return (
    <footer className="border-t border-rule pt-4 text-center text-sm text-muted">
      <p>{line}</p>
      <div className="mt-3 hidden justify-center opacity-60 print:flex"><Brand href="/" /></div>
    </footer>
  );
}

export function InvoiceDoc({ no, issued, from, client, title, total, paid, remaining, cur }: {
  no: string; issued: Date; from: Party; client: string; title: string; total: number; paid: number; remaining: number; cur: string;
}) {
  const row = (k: string, v: number, strong = false) => (
    <div className={`flex justify-between py-1.5 ${strong ? "border-t-2 border-ink pt-2.5 font-bold" : ""}`}>
      <span className={strong ? "" : "text-muted"}>{k}</span><span className="num">{fmt(v)} {cur}</span>
    </div>
  );
  return (
    <Shell>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-5">
        <div className="grid gap-2"><Logo from={from} /><h1 className="text-3xl font-extrabold">فاتورة</h1><p className="num text-sm text-muted">{no}</p></div>
        <div className="grid gap-1 text-sm sm:text-left"><span className="text-muted">تاريخ الإصدار</span><span className="font-semibold">{longDate(issued)}</span></div>
      </header>
      <Parties from={from} to={client} />
      <table className="w-full border-collapse text-[0.9375rem]">
        <thead>
          <tr className="border-b border-ink text-right text-sm text-muted"><th className="py-2 font-medium">البيان</th><th className="w-40 py-2 text-left font-medium">المبلغ</th></tr>
        </thead>
        <tbody>
          <tr className="border-b border-rule"><td className="py-3 font-semibold">{title}</td><td className="num py-3 text-left">{fmt(total)} {cur}</td></tr>
        </tbody>
      </table>
      <div className="grid w-full gap-0.5 text-[0.9375rem] sm:mr-auto sm:max-w-xs print:mr-auto print:max-w-xs">
        {row("الإجمالي", total)}{row("المدفوع", paid)}{row("المتبقي المستحق", remaining, true)}
      </div>
      {remaining === 0 ? <p className="text-center font-semibold text-money">تم سداد الفاتورة بالكامل. شكرًا لكم.</p> : <PayInfo from={from} />}
      <Footer line="شكرًا لتعاملكم معنا." />
    </Shell>
  );
}

export function QuoteDoc({ no, created, validUntil, from, client, title, items, total, deliveryDays, notes, cur }: {
  no: string; created: Date; validUntil: Date; from: Party; client: string; title: string; items: QuoteItem[]; total: number;
  deliveryDays: number | null; notes: string; cur: string;
}) {
  return (
    <Shell>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-rule pb-5">
        <div className="grid gap-2"><Logo from={from} /><h1 className="text-3xl font-extrabold">عرض سعر</h1><p className="num text-sm text-muted">{no}</p></div>
        <div className="grid gap-1 text-sm sm:text-left">
          <span className="text-muted">التاريخ</span><span className="font-semibold">{longDate(created)}</span>
          <span className="mt-1 text-muted">ساري حتى</span><span className="font-semibold">{longDate(validUntil)}</span>
        </div>
      </header>
      <Parties from={from} to={client} />
      <div>
        <p className="mb-2 font-display text-lg font-bold">{title}</p>
        <table className="w-full border-collapse text-[0.9375rem]">
          <thead>
            <tr className="border-b border-ink text-right text-sm text-muted">
              <th className="w-10 py-2 pl-3 font-medium">#</th><th className="py-2 font-medium">البيان</th><th className="w-40 py-2 text-left font-medium">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x, i) => (
              <tr key={i} className="border-b border-rule">
                <td className="num py-2.5 pl-3 text-muted">{i + 1}</td>
                <td className="py-2.5 [overflow-wrap:anywhere]">{x.desc}</td>
                <td className="num py-2.5 text-left">{fmt(x.amount)} {cur}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between border-t-2 border-ink pt-2.5 text-[1.0625rem] font-bold sm:mr-auto sm:w-72 print:mr-auto print:w-72">
        <span>الإجمالي</span><span className="num">{fmt(total)} {cur}</span>
      </div>
      {(deliveryDays || notes) && (
        <section className="grid gap-1.5 text-sm">
          {deliveryDays ? <p><span className="text-muted">مدة التنفيذ: </span>{deliveryDays} يوم من تاريخ الموافقة</p> : null}
          {notes && <p className="whitespace-pre-wrap"><span className="text-muted">الشروط: </span>{notes}</p>}
        </section>
      )}
      <PayInfo from={from} />
      <Footer line="يسعدنا تعاونكم، ونتطلع للعمل معكم." />
    </Shell>
  );
}
