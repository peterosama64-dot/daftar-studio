/* eslint-disable @next/next/no-img-element -- the owner's logo comes from Blob storage */
import { Card } from "./ui";

const when = (d: Date) => d.toLocaleString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: process.env.APP_TIMEZONE || "Africa/Cairo" });

/** The contract as a document: first line is the title, the rest as written; acceptance stamp at the end. */
export function ContractDoc({ body, logoUrl, accepted }: { body: string; logoUrl?: string | null; accepted?: { name: string; at: Date } | null }) {
  const [title, ...rest] = body.split("\n");
  return (
    <Card className="mx-auto grid w-full max-w-2xl gap-4 p-6 lg:p-9 print:max-w-none print:rounded-none print:border-0 print:bg-white print:p-0">
      {logoUrl && <img src={logoUrl} alt="" className="max-h-14 max-w-36 object-contain" />}
      <h1 className="text-2xl font-extrabold [overflow-wrap:anywhere]">{title}</h1>
      <div className="whitespace-pre-line text-[0.9375rem] leading-8 [overflow-wrap:anywhere]">{rest.join("\n").trim()}</div>
      {accepted ? (
        <div className="rounded-xl border border-money bg-money-soft p-4 text-sm print:bg-white">
          <p className="font-semibold text-money">تمت الموافقة إلكترونيًّا</p>
          <p>باسم: <b>{accepted.name}</b> — بتاريخ {when(accepted.at)}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-6 pt-6 text-sm text-muted print:grid">
          <div className="border-t border-rule pt-2">الطرف الأول</div><div className="border-t border-rule pt-2">الطرف الثاني</div>
        </div>
      )}
    </Card>
  );
}
