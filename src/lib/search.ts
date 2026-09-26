import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { normalizeDigits } from "./heuristic";

/** Arabic letter forms people type interchangeably: أ إ آ → ا, ى → ي, ة → ه. Same map in SQL (translate). */
const FROM = "أإآىة", TO = "ااايه";
export function foldArabic(s: string): string {
  let out = normalizeDigits(s).toLowerCase().trim().replace(/\s+/g, " ");
  for (let i = 0; i < FROM.length; i++) out = out.split(FROM[i]).join(TO[i]);
  return out.replace(/[ً-ْـ]/g, ""); // harakat and tatweel
}

const like = (q: string) => `%${q.replace(/[\\%_]/g, (c) => "\\" + c)}%`;
const col = (c: string) => Prisma.raw(`lower(translate(regexp_replace(${c}, '[\\u064B-\\u0652\\u0640]', '', 'g'), '${FROM}', '${TO}'))`);

export type SearchResults = Awaited<ReturnType<typeof search>>;

/** Everything of this user whose text matches `q` (Arabic-letter-form tolerant), up to 20 per kind. */
export async function search(userId: string, q: string) {
  const p = like(foldArabic(q));
  const [tasks, entries, quotes, infos] = await Promise.all([
    prisma.$queryRaw<{ id: string; title: string; client: string; status: string; due: Date | null }[]>`
      SELECT id, title, client, status, due FROM "Task"
      WHERE "userId" = ${userId} AND (${col('title')} LIKE ${p} OR ${col('client')} LIKE ${p} OR ${col('notes')} LIKE ${p})
      ORDER BY (status = 'done'), "createdAt" DESC LIMIT 20`,
    prisma.$queryRaw<{ id: string; kind: string; name: string; client: string; amount: number; date: Date | null }[]>`
      SELECT id, kind, name, client, amount, date FROM "Entry"
      WHERE "userId" = ${userId} AND (${col('name')} LIKE ${p} OR ${col('client')} LIKE ${p})
      ORDER BY "createdAt" DESC LIMIT 20`,
    prisma.$queryRaw<{ id: string; title: string; client: string; status: string }[]>`
      SELECT id, title, client, status FROM "Quote"
      WHERE "userId" = ${userId} AND (${col('title')} LIKE ${p} OR ${col('client')} LIKE ${p})
      ORDER BY "createdAt" DESC LIMIT 20`,
    prisma.$queryRaw<{ name: string }[]>`
      SELECT name FROM "ClientInfo"
      WHERE "userId" = ${userId} AND (${col('name')} LIKE ${p} OR ${col('notes')} LIKE ${p} OR phone LIKE ${p} OR lower(email) LIKE ${p})
      LIMIT 20`,
  ]);
  const clients = [...new Set([...tasks.map((t) => t.client), ...entries.map((e) => e.client), ...quotes.map((x) => x.client)]
    .filter((c) => c && foldArabic(c).includes(foldArabic(q))).concat(infos.map((i) => i.name)))].slice(0, 20);
  return { tasks, entries, quotes, clients };
}
