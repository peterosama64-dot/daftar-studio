import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));

// In-memory stand-in for the one table Gmail uses.
const rows = new Map<string, { userId: string; email: string; refreshToken: string }>();
vi.mock("../src/lib/db", () => ({
  prisma: {
    gmailAccount: {
      findUnique: async ({ where }: any) => rows.get(where.userId) ?? null,
      upsert: async ({ where, create, update }: any) => { rows.set(where.userId, { ...(rows.get(where.userId) ?? create), ...update }); },
      deleteMany: async ({ where }: any) => { rows.delete(where.userId); },
    },
  },
}));

import { open, seal } from "../src/lib/crypto";
import { authUrl, bodyText, connectGmail, disconnectGmail, GMAIL_SCOPE, recentMail } from "../src/lib/gmail";

const b64url = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => { process.env.GOOGLE_CLIENT_ID = "cid"; process.env.GOOGLE_CLIENT_SECRET = "csecret"; rows.clear(); });
afterEach(() => vi.unstubAllGlobals());

describe("token sealing", () => {
  it("round-trips and never stores the plaintext", () => {
    const s = seal("1//refresh-token");
    expect(s).not.toContain("refresh");
    expect(open(s)).toBe("1//refresh-token");
  });
  it("rejects tampering and junk", () => {
    const [v, iv, tag, body] = seal("abc").split(".");
    expect(open([v, iv, tag, body.slice(0, -2) + (body.endsWith("A") ? "BB" : "AA")].join("."))).toBeNull();
    expect(open("garbage")).toBeNull();
  });
});

describe("gmail", () => {
  it("builds a read-only offline consent URL with state", () => {
    const u = new URL(authUrl("https://x.test", "st4te"));
    expect(u.origin).toBe("https://accounts.google.com");
    expect(u.searchParams.get("scope")).toBe(GMAIL_SCOPE);
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("redirect_uri")).toBe("https://x.test/api/gmail/callback");
    expect(u.searchParams.get("state")).toBe("st4te");
  });

  it("prefers text/plain, strips HTML otherwise, and cuts quoted replies", () => {
    expect(bodyText({ mimeType: "multipart/alternative", parts: [
      { mimeType: "text/html", body: { data: b64url("<p>html</p>") } },
      { mimeType: "text/plain", body: { data: b64url("عايزين بوستر\n\nOn Mon, Sep 22 2026 Peter wrote:\n> old") } },
    ] })).toBe("عايزين بوستر");
    expect(bodyText({ mimeType: "text/html", body: { data: b64url("<div>فاتورة&nbsp;Adobe</div><style>x{}</style><p>720 EGP</p>") } })).toBe("فاتورة Adobe\n 720 EGP");
  });

  it("connects, lists and reads mail, then disconnects", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (u: any, init: any) => {
      const url = String(u); calls.push(url);
      if (url.startsWith("https://oauth2.googleapis.com/token")) {
        const b = new URLSearchParams(init.body);
        if (b.get("grant_type") === "authorization_code") return json({ access_token: "at1", refresh_token: "rt1", scope: GMAIL_SCOPE });
        expect(b.get("refresh_token")).toBe("rt1");
        return json({ access_token: "at2" });
      }
      if (url.endsWith("/profile")) return json({ emailAddress: "me@gmail.com" });
      if (url.includes("/messages?")) { expect(decodeURIComponent(url)).toContain("newer_than:14d"); return json({ messages: [{ id: "m1" }] }); }
      if (url.includes("/messages/m1")) return json({ id: "m1", snippet: "hi", payload: { mimeType: "text/plain", body: { data: b64url("حولتلك 3000") }, headers: [{ name: "From", value: "Cafe <c@x.com>" }, { name: "Subject", value: "دفعة" }] } });
      if (url.startsWith("https://oauth2.googleapis.com/revoke")) return json({});
      throw new Error("unexpected " + url);
    }));
    expect(await connectGmail("u1", "code", "https://x.test")).toBe("ok");
    const saved = rows.get("u1")!;
    expect(saved.email).toBe("me@gmail.com");
    expect(saved.refreshToken).not.toContain("rt1");
    const mails = await recentMail("u1");
    expect(mails).toEqual([{ id: "m1", from: "Cafe <c@x.com>", subject: "دفعة", date: "", snippet: "hi", text: "حولتلك 3000" }]);
    await disconnectGmail("u1");
    expect(rows.has("u1")).toBe(false);
    expect(calls.some((c) => c.includes("/revoke?token=rt1"))).toBe(true);
  });

  it("refuses a grant without the Gmail scope or without a refresh token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ access_token: "a", refresh_token: "r", scope: "openid" })));
    expect(await connectGmail("u2", "c", "https://x.test")).toBe("no_scope");
    vi.stubGlobal("fetch", vi.fn(async () => json({ access_token: "a", scope: GMAIL_SCOPE })));
    expect(await connectGmail("u2", "c", "https://x.test")).toBe("no_refresh");
    expect(rows.has("u2")).toBe(false);
  });

  it("asks to reconnect (and forgets the grant) when Google revokes it", async () => {
    rows.set("u3", { userId: "u3", email: "a@b", refreshToken: seal("dead") });
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "invalid_grant" }, 400)));
    expect(await recentMail("u3")).toBe("reconnect");
    expect(rows.has("u3")).toBe(false);
  });
});
