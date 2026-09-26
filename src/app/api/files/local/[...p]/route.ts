import { readFile } from "node:fs/promises";
import { localFile } from "@/lib/files";
import { sniffType } from "@/lib/revisions";

// Local testing only (LOCAL_FILES=1): serve files saved on disk. In production files come from Vercel Blob.
export async function GET(_req: Request, { params }: { params: Promise<{ p: string[] }> }) {
  if (process.env.LOCAL_FILES !== "1") return new Response("Not found", { status: 404 });
  const file = localFile((await params).p);
  if (!file) return new Response("Not found", { status: 404 });
  const data = await readFile(file).catch(() => null);
  if (!data) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(data), { headers: { "content-type": sniffType(data) ?? "application/octet-stream" } });
}
