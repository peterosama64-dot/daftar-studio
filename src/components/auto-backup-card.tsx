import { prisma } from "@/lib/db";
import { AR_DAYS, shortDate } from "@/lib/dates";
import { KEEP } from "@/lib/auto-backup";
import { mailConfigured } from "@/lib/mail";
import { backupNow, setAutoBackup } from "@/app/app/actions";
import { Button, Card } from "./ui";

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} ك.ب` : `${(n / 1024 / 1024).toFixed(1)} م.ب`);

/** Weekly automatic copies, kept inside the app (and emailed when email is set up). */
export async function AutoBackupCard({ uid, on }: { uid: string; on: boolean }) {
  const list = await prisma.autoBackup.findMany({ where: { userId: uid }, orderBy: { createdAt: "desc" }, select: { id: true, size: true, createdAt: true } });
  return (
    <Card className="grid gap-3 p-5" aria-labelledby="ab-h">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ab-h" className="text-lg font-bold">نسخة احتياطية تلقائية</h2>
        <form action={setAutoBackup.bind(null, !on)}><Button small kind={on ? "ghost" : "primary"}>{on ? "وقّفها" : "شغّلها"}</Button></form>
      </div>
      <p className="text-sm text-muted">
        {on ? `كل أسبوع بنحفظ نسخة من دفترك كله، وبنفضل محتفظين بآخر ${KEEP} نسخ.` : "متوقفة: مفيش نسخ بتتعمل لوحدها."}
        {on && mailConfigured() ? " وبتوصلك كمان على إيميلك." : ""}
      </p>
      {list.length ? (
        <ul className="grid gap-1 text-sm">
          {list.map((b) => (
            <li key={b.id} className="flex items-center justify-between gap-2 border-b border-rule py-1.5 last:border-b-0">
              <span>{AR_DAYS[b.createdAt.getDay()]} <span className="num">{shortDate(b.createdAt)}/{b.createdAt.getFullYear()}</span> <span className="text-muted">· {kb(b.size)}</span></span>
              <a href={`/api/backup/auto/${b.id}`} className="text-cyan">نزّلها</a>
            </li>
          ))}
        </ul>
      ) : <p className="text-sm text-muted">لسه مفيش نسخ. أول نسخة هتتعمل خلال يوم، أو اعملها دلوقتي.</p>}
      <form action={backupNow}><Button small kind="secondary">اعمل نسخة دلوقتي</Button></form>
      <p className="text-xs text-muted">عشان ترجّع نسخة: نزّلها، وبعدين من «نسخة احتياطية» تحت اختار «استرجع من ملف».</p>
    </Card>
  );
}
