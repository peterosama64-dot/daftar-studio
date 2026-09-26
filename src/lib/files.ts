import "server-only";
import { del, put } from "@vercel/blob";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";

// Delivered files live in Vercel Blob (BLOB_READ_WRITE_TOKEN is set when the store is connected).
// For local testing only, LOCAL_FILES=1 keeps them on disk and serves them from /api/files/local.
const LOCAL_DIR = "/tmp/daftar-files";
export const filesConfigured = () => !!process.env.BLOB_READ_WRITE_TOKEN || process.env.LOCAL_FILES === "1";

export async function putFile(key: string, data: Buffer, contentType: string): Promise<string> {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const b = await put(key, data, { access: "public", contentType, addRandomSuffix: true });
    return b.url;
  }
  if (process.env.LOCAL_FILES === "1") {
    const name = key.replace(/(\.[a-z]+)$/, `-${randomBytes(6).toString("hex")}$1`);
    const file = path.join(LOCAL_DIR, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
    return `/api/files/local/${name}`;
  }
  throw new Error("file storage not configured");
}

export async function removeFile(url: string) {
  try {
    if (url.startsWith("/api/files/local/")) await unlink(path.join(LOCAL_DIR, url.slice("/api/files/local/".length)));
    else if (process.env.BLOB_READ_WRITE_TOKEN) await del(url);
  } catch (e) { console.warn("removeFile", e instanceof Error ? e.message : e); }
}

export const localFile = (parts: string[]) => {
  const file = path.join(LOCAL_DIR, ...parts);
  return file.startsWith(LOCAL_DIR + path.sep) ? file : null;
};
