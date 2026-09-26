import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ApiError as GeminiApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { dayKey, AR_DAYS, now } from "./dates";
import { ParsedSchema, type Parsed } from "./parsed";
import { heuristicParse } from "./heuristic";

const CLAUDE_MODEL = "claude-opus-5";
// "latest" aliases so a retired Gemini version never breaks the app; override the first with GEMINI_MODEL.
// The free tier often answers 503 "high demand": retry once, then try the lighter model.
const geminiModels = () => [process.env.GEMINI_MODEL || "gemini-flash-latest", "gemini-flash-lite-latest"];
const BUSY = new Set([429, 500, 503]);

export type AiProvider = "claude" | "gemini";

/** Claude when ANTHROPIC_API_KEY is set, else Gemini when GEMINI_API_KEY is set, else none (offline parser). */
export function aiProvider(): AiProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "claude";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return null;
}
export const aiEnabled = () => aiProvider() !== null;
export const aiName = () => (aiProvider() === "gemini" ? "Gemini" : "Claude");

const claude = () => new Anthropic();
const gemini = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 15_000 } });

/** Call Gemini, retrying a busy model once and then moving to the next one. Throws the last error. */
async function geminiGenerate(contents: string, config: Parameters<GoogleGenAI["models"]["generateContent"]>[0]["config"]) {
  const ai = gemini();
  let last: unknown;
  for (const model of geminiModels()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        return await ai.models.generateContent({ model, contents, config });
      } catch (e) {
        last = e;
        if (!(e instanceof GeminiApiError && BUSY.has(e.status))) throw e;
        console.warn(`Gemini ${model} busy (${e.status}), attempt ${attempt + 1}`);
        if (attempt === 0) await new Promise((r) => setTimeout(r, 1200));
      }
    }
  }
  throw last;
}

const parseSystem = (currency: string, today: Date) =>
  `You organise the work log of a freelance graphic designer / art director in Egypt or the Gulf. ` +
  `Today is ${AR_DAYS[today.getDay()]} ${dayKey(today)}. Default currency: ${currency}. ` +
  `Extract every task and every money movement from the user's text (Egyptian colloquial Arabic, English, or client messages). ` +
  `Rules: resolve relative dates (بكرة, الخميس الجاي, آخر الشهر) to real YYYY-MM-DD dates; use "" when there is no date. ` +
  `"مستعجل", "ضروري", "النهارده" mean priority high. "خلصت" / "سلّمت" something means status done. ` +
  `Convert Arabic-Indic digits and "٥ آلاف" style amounts to numbers. Divide a yearly subscription by 12. ` +
  `Write titles and names in short Arabic as the user would. Never invent items that are not in the text.`;

const REPORT_SYSTEM =
  "You are the business manager of a freelance designer in Egypt. Write the monthly report in Egyptian colloquial Arabic, " +
  "120–200 words, plain paragraphs, no markdown, no emojis. Order: what got done; what is left; what to start with first " +
  "and why (with dates); what can wait; then money: income, subscriptions, expenses, net profit, and one useful observation. " +
  "Use only the numbers in the data.";

/** Turn free Egyptian-Arabic text (voice, WhatsApp, email) into tasks and money rows. */
export async function parseText(text: string, currency: string, today = now()): Promise<{ data: Parsed; via: AiProvider | "offline" }> {
  const offline = () => ({ data: heuristicParse(text, today), via: "offline" as const });
  const input = text.slice(0, 40_000);
  const provider = aiProvider();
  if (provider === "claude") {
    try {
      const res = await claude().messages.parse({
        model: CLAUDE_MODEL,
        max_tokens: 8000,
        output_config: { effort: "low", format: zodOutputFormat(ParsedSchema) },
        system: parseSystem(currency, today),
        messages: [{ role: "user", content: input }],
      });
      if (res.stop_reason === "refusal" || !res.parsed_output) return offline();
      return { data: res.parsed_output, via: "claude" };
    } catch (e) {
      if (e instanceof Anthropic.APIError) { console.error("parseText: Claude API error", e.status, e.message); return offline(); }
      throw e;
    }
  }
  if (provider === "gemini") {
    try {
      const res = await geminiGenerate(input, {
        systemInstruction: parseSystem(currency, today),
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(ParsedSchema),
      });
      const parsed = ParsedSchema.safeParse(JSON.parse(res.text ?? ""));
      if (!parsed.success) { console.error("parseText: Gemini returned an unexpected shape"); return offline(); }
      return { data: parsed.data, via: "gemini" };
    } catch (e) {
      console.error("parseText: Gemini error", e instanceof GeminiApiError ? e.status : "", e instanceof Error ? e.message : e);
      return offline();
    }
  }
  return offline();
}

/** Short monthly report in Egyptian Arabic, from already-computed numbers. Null when no AI is configured or it fails. */
export async function writeReport(data: unknown): Promise<string | null> {
  const provider = aiProvider();
  if (provider === "claude") {
    try {
      const res = await claude().messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        output_config: { effort: "low" },
        system: REPORT_SYSTEM,
        messages: [{ role: "user", content: JSON.stringify(data) }],
      });
      if (res.stop_reason === "refusal") return null;
      return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim() || null;
    } catch (e) {
      if (e instanceof Anthropic.APIError) { console.error("writeReport: Claude API error", e.status, e.message); return null; }
      throw e;
    }
  }
  if (provider === "gemini") {
    try {
      const res = await geminiGenerate(JSON.stringify(data), { systemInstruction: REPORT_SYSTEM });
      return res.text?.trim() || null;
    } catch (e) {
      console.error("writeReport: Gemini error", e instanceof GeminiApiError ? e.status : "", e instanceof Error ? e.message : e);
      return null;
    }
  }
  return null;
}
