import "server-only";
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

// AES-256-GCM for secrets we must keep (Gmail refresh tokens). The key is derived
// from SESSION_SECRET, so rotating that secret just means reconnecting Gmail.
function key(): Buffer {
  const secret = process.env.SESSION_SECRET || (process.env.NODE_ENV === "production" ? "" : "dev-only-secret-change-me-dev-only-secret");
  if (secret.length < 32) throw new Error("SESSION_SECRET must be set (32+ chars)");
  return Buffer.from(hkdfSync("sha256", secret, "daftar", "gmail-refresh-token", 32));
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

/** The plaintext, or null if the value was tampered with or sealed under another key. */
export function open(sealed: string): string | null {
  const [v, iv, tag, body] = sealed.split(".");
  if (v !== "v1" || !iv || !tag || !body) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
