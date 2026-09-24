import { z } from "zod";

/** The shape «رتّبهالي» returns, from Claude or from the offline parser. */
export const ParsedSchema = z.object({
  tasks: z.array(z.object({
    title: z.string(),
    client: z.string(),
    due: z.string().describe("YYYY-MM-DD or empty"),
    priority: z.enum(["high", "normal", "low"]),
    status: z.enum(["todo", "done"]),
  })),
  income: z.array(z.object({
    name: z.string(),
    client: z.string(),
    amount: z.number(),
    date: z.string().describe("YYYY-MM-DD"),
  })),
  subscriptions: z.array(z.object({
    name: z.string(),
    amount: z.number().describe("monthly amount"),
  })),
  expenses: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    date: z.string().describe("YYYY-MM-DD"),
  })),
});
export type Parsed = z.infer<typeof ParsedSchema>;

export const emptyParsed = (): Parsed => ({ tasks: [], income: [], subscriptions: [], expenses: [] });
export const parsedCount = (p: Parsed) => p.tasks.length + p.income.length + p.subscriptions.length + p.expenses.length;
