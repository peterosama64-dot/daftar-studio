import { requireUser } from "@/lib/auth";
import { aiEnabled } from "@/lib/ai";
import { ASK_EXAMPLES } from "@/lib/ask";
import { PageHead } from "@/components/month";
import { AskBox } from "@/components/ask-box";

export const metadata = { title: "اسأل دفترك" };

export default async function Ask() {
  await requireUser();
  return (
    <>
      <PageHead title="اسأل دفترك" base="/app/ask" sub="اسأل بالعامية عن فلوسك وشغلك، والأرقام بتتحسب من دفترك نفسه" />
      {aiEnabled() ? <AskBox examples={ASK_EXAMPLES} />
        : <p className="rounded-xl border border-wait bg-wait-soft px-4 py-3 text-sm">المساعد محتاج الذكاء الاصطناعي يكون متوصّل، وده مش متظبط دلوقتي.</p>}
    </>
  );
}
