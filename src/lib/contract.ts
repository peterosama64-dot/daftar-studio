import { fmt } from "./money";

export type ContractInput = {
  owner: { name: string; email: string; phone?: string; address?: string };
  client: string;
  title: string;
  steps: string[];
  price: number | null;
  cur: string;
  payments: { label: string; amount: number; due: Date | null }[];
  due: Date | null;
  revisions: number | null;
  today: Date;
};

const date = (d: Date) => d.toLocaleDateString("ar-EG-u-nu-latn", { day: "numeric", month: "long", year: "numeric" });

/**
 * A plain, formal-Arabic work agreement filled from the task. It is a starting point the owner edits;
 * each numbered clause is on its own paragraph so it reads well and prints cleanly.
 */
export function draftContract(c: ContractInput): string {
  const owner = c.owner.name || c.owner.email;
  const ownerLine = [owner, c.owner.phone, c.owner.address].filter(Boolean).join(" — ");
  const clauses: string[] = [];
  clauses.push(`موضوع الاتفاق: يلتزم الطرف الأول بتنفيذ «${c.title}» لصالح الطرف الثاني${c.steps.length ? `، ويشمل ذلك:\n${c.steps.map((s) => `   - ${s}`).join("\n")}` : "."}`);
  if (c.price) {
    let pay = `المقابل المالي: يلتزم الطرف الثاني بسداد مبلغ إجمالي قدره ${fmt(c.price)} ${c.cur}`;
    pay += c.payments.length
      ? `، على النحو التالي:\n${c.payments.map((p) => `   - ${p.label}: ${fmt(p.amount)} ${c.cur}${p.due ? ` بتاريخ ${date(p.due)}` : ""}`).join("\n")}`
      : "، يُسدَّد عند التسليم ما لم يُتفق على غير ذلك كتابةً.";
    clauses.push(pay);
  }
  clauses.push(c.due ? `مدة التنفيذ: يُسلَّم العمل في موعد أقصاه ${date(c.due)}، على أن يلتزم الطرف الثاني بتوفير ما يلزم من معلومات ومواد في الوقت المناسب، ويُمد الموعد بقدر أي تأخير في ذلك.` : "مدة التنفيذ: يُتفق على موعد التسليم كتابةً بين الطرفين.");
  clauses.push(c.revisions !== null
    ? `التعديلات: يشمل المقابل ${c.revisions === 0 ? "عدم إجراء تعديلات" : `عدد ${c.revisions} ${c.revisions <= 10 && c.revisions >= 3 ? "تعديلات" : "تعديل"}`} على العمل المسلَّم، وأي تعديل إضافي يُحتسب بمقابل يُتفق عليه.`
    : "التعديلات: يُتفق على عدد التعديلات المشمولة في المقابل، وأي تعديل إضافي يُحتسب بمقابل يُتفق عليه.");
  clauses.push("الملكية الفكرية: تنتقل حقوق استخدام العمل النهائي إلى الطرف الثاني بعد سداد كامل المقابل. ويحق للطرف الأول عرض العمل ضمن أعماله السابقة (البورتفوليو) ما لم يُتفق كتابةً على خلاف ذلك.");
  clauses.push("الإلغاء: إذا ألغى الطرف الثاني العمل بعد البدء فيه، لا تُسترد الدفعة المقدمة، ويستحق الطرف الأول مقابل ما تم إنجازه حتى تاريخ الإلغاء.");
  clauses.push("السرية: يلتزم الطرفان بالحفاظ على سرية ما يُتبادل بينهما من معلومات غير منشورة.");
  return [
    `اتفاق عمل — ${c.title}`,
    `تحرر هذا الاتفاق بتاريخ ${date(c.today)} بين كلٍّ من:`,
    `الطرف الأول (المصمم): ${ownerLine}`,
    `الطرف الثاني (العميل): ${c.client || "…………"}`,
    "",
    ...clauses.map((t, i) => `${i + 1}. ${t}`),
    "",
    "وافق الطرفان على ما ورد أعلاه، ويُعد قبول الطرف الثاني لهذا الاتفاق إلكترونيًّا بمثابة توقيعه عليه.",
  ].join("\n");
}
