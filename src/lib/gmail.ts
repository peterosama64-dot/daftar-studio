import "server-only";
import { prisma } from "./db";
import { open, seal } from "./crypto";

// Gmail over plain REST: OAuth code flow with a read-only scope, then list + read messages.
// Nothing from the mailbox is stored; only the (encrypted) refresh token.
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const API = "https://gmail.googleapis.com/gmail/v1/users/me";

export const gmailConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const redirectUri = (origin: string) => process.env.GOOGLE_REDIRECT_URI || `${origin}/api/gmail/callback`;

export function authUrl(origin: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: GMAIL_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH}?${q}`;
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; scope?: string; error?: string };
  return { ok: res.ok, ...j };
}

/** Code → tokens → mailbox address, saved for this user. Returns an error code on failure. */
export async function connectGmail(userId: string, code: string, origin: string): Promise<"ok" | "no_refresh" | "no_scope" | "failed"> {
  const t = await tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri(origin) });
  if (!t.ok || !t.access_token) return "failed";
  if (!t.scope?.split(" ").includes(GMAIL_SCOPE)) return "no_scope";
  if (!t.refresh_token) return "no_refresh";
  const profile = await fetch(`${API}/profile`, { headers: { authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(15_000) });
  const email = profile.ok ? String(((await profile.json()) as { emailAddress?: string }).emailAddress ?? "") : "";
  const refreshToken = seal(t.refresh_token);
  await prisma.gmailAccount.upsert({ where: { userId }, create: { userId, email, refreshToken }, update: { email, refreshToken } });
  return "ok";
}

export async function disconnectGmail(userId: string) {
  const acc = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!acc) return;
  const token = open(acc.refreshToken);
  if (token) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST", signal: AbortSignal.timeout(10_000) }).catch(() => {});
  await prisma.gmailAccount.deleteMany({ where: { userId } });
}

/** A fresh access token, or "reconnect" when Google no longer accepts the saved grant (it is then removed). */
async function accessToken(userId: string): Promise<string | "reconnect" | null> {
  const acc = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!acc) return null;
  const refresh = open(acc.refreshToken);
  if (!refresh) { await prisma.gmailAccount.deleteMany({ where: { userId } }); return "reconnect"; }
  const t = await tokenRequest({ refresh_token: refresh, grant_type: "refresh_token" });
  if (t.access_token) return t.access_token;
  if (t.error === "invalid_grant") { await prisma.gmailAccount.deleteMany({ where: { userId } }); return "reconnect"; }
  throw new Error(`Gmail token refresh failed: ${t.error ?? "unknown"}`);
}

export type Mail = { id: string; from: string; subject: string; date: string; snippet: string; text: string };

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[] };
const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
const stripHtml = (h: string) =>
  h.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;/g, "'").replace(/&quot;/g, '"');

/** Plain text of a message: text/plain if present, else stripped HTML. Quoted replies are cut. */
export function bodyText(p: Part): string {
  const find = (part: Part, type: string): string | null => {
    if (part.mimeType === type && part.body?.data) return b64(part.body.data);
    for (const c of part.parts ?? []) { const r = find(c, type); if (r) return r; }
    return null;
  };
  const plain = find(p, "text/plain");
  const text = plain ?? stripHtml(find(p, "text/html") ?? "");
  return text
    .split(/\n(?:On .{5,120} wrote:|في .{5,120} كتب:|-{2,}\s*Original Message)/)[0]
    .split("\n").filter((l) => !l.startsWith(">")).join("\n")
    .replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    .slice(0, 6000);
}

// Last two weeks, without promotions/social/forums: client mail and receipts.
const QUERY = "newer_than:14d -category:promotions -category:social -category:forums -in:chats";

export async function recentMail(userId: string, max = 15): Promise<Mail[] | "reconnect" | null> {
  const token = await accessToken(userId);
  if (token === null || token === "reconnect") return token;
  const h = { authorization: `Bearer ${token}` };
  const list = await fetch(`${API}/messages?${new URLSearchParams({ q: QUERY, maxResults: String(max) })}`, { headers: h, signal: AbortSignal.timeout(15_000) });
  if (!list.ok) throw new Error(`Gmail list failed: ${list.status}`);
  const ids = (((await list.json()) as { messages?: { id: string }[] }).messages ?? []).map((m) => m.id);
  const mails = await Promise.all(ids.map(async (id) => {
    const r = await fetch(`${API}/messages/${id}?format=full`, { headers: h, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) return null;
    const m = (await r.json()) as { id: string; snippet?: string; payload?: Part & { headers?: { name: string; value: string }[] } };
    const header = (n: string) => m.payload?.headers?.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    return { id: m.id, from: header("from"), subject: header("subject"), date: header("date"), snippet: m.snippet ?? "", text: m.payload ? bodyText(m.payload) : "" };
  }));
  return mails.filter((m): m is Mail => m !== null);
}
