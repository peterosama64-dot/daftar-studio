import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { dayKey, AR_DAYS, now } from "./dates";
import { ParsedSchema, type Parsed } from "./parsed";
import { heuristicParse } from "./heuristic";

const MODEL = "claude-opus-5";

export const aiEnabled = () => !!process.env.ANTHROPIC_API_KEY;

const client = () => new Anthropic();

/** Turn free Egyptian-Arabic text (voice, WhatsApp, email) into tasks and money rows. */
export async function parseText(text: string, currency: string, today = now()): Promise<{ data: Parsed; via: "claude" | "offline" }> {
  if (!aiEnabled()) return { data: heuristicParse(text, today), via: "offline" };
  try {
    const res = await client().messages.parse({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(ParsedSchema) },
      system:
        `You organise the work log of a freelance graphic designer / art director in Egypt or the Gulf. ` +
        `Today is ${AR_DAYS[today.getDay()]} ${dayKey(today)}. Default currency: ${currency}. ` +
        `Extract every task and every money movement from the user's text (Egyptian colloquial Arabic, English, or client messages). ` +
        `Rules: resolve relative dates (بكرة, الخميس الجاي, آخر الشهر) to real YYYY-MM-DD dates; use "" when there is no date. ` +
        `"مستعجل", "ضروري", "النهارده" mean priority high. "خلصت" / "سلّمت" something means status done. ` +
        `Convert Arabic-Indic digits and "٥ آلاف" style amounts to numbers. Divide a yearly subscription by 12. ` +
        `Write titles and names in short Arabic as the user would. Never invent items that are not in the text.`,
      messages: [{ role: "user", content: text.slice(0, 40_000) }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) return { data: heuristicParse(text, today), via: "offline" };
    return { data: res.parsed_output, via: "claude" };
  } catch (e) {
    if (e instanceof Anthropic.APIError) {
      console.error("parseText: Claude API error", e.status, e.message);
      return { data: heuristicParse(text, today), via: "offline" };
    }
    throw e;
  }
}

/** Short monthly report in Egyptian Arabic, from already-computed numbers. Null when Claude is not configured. */
export async function writeReport(data: unknown): Promise<string | null> {
  if (!aiEnabled()) return null;
  try {
    const res = await client().messages.create({
      model: MODEL,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system:
        "You are the business manager of a freelance designer in Egypt. Write the monthly report in Egyptian colloquial Arabic, " +
        "120–200 words, plain paragraphs, no markdown, no emojis. Order: what got done; what is left; what to start with first " +
        "and why (with dates); what can wait; then money: income, subscriptions, expenses, net profit, and one useful observation. " +
        "Use only the numbers in the data.",
      messages: [{ role: "user", content: JSON.stringify(data) }],
    });
    if (res.stop_reason === "refusal") return null;
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || null;
  } catch (e) {
    if (e instanceof Anthropic.APIError) { console.error("writeReport: Claude API error", e.status, e.message); return null; }
    throw e;
  }
}
