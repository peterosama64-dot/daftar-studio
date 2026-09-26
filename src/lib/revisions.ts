/** Where a task stands on revisions: how many were used against how many the price includes. */
export function revisionState(used: number, allowed: number | null) {
  const limited = allowed !== null && allowed >= 0;
  return {
    used,
    allowed,
    left: limited ? Math.max(0, allowed - used) : null,
    over: limited ? Math.max(0, used - allowed) : 0,
    /** The next revision would be beyond what was agreed (so it can be charged). */
    nextIsExtra: limited && used >= allowed,
  };
}

/** Delivery round for a new upload: first delivery is round 1, each revision request starts the next. */
export const currentRound = (revisions: number) => revisions + 1;

export const ACCEPTED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf",
};
export const MAX_FILE = 4 * 1024 * 1024; // Vercel functions take bodies up to 4.5 MB

/** Check the first bytes, so a renamed executable can't pass as an image. */
export function sniffType(b: Uint8Array): string | null {
  const s = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (s(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (s(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (s(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (s(0, 0x52, 0x49, 0x46, 0x46) && s(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (s(0, 0x25, 0x50, 0x44, 0x46)) return "application/pdf";
  return null;
}

export const safeName = (n: string) => n.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").trim().slice(0, 100) || "file";
