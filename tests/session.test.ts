import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "../src/lib/session";

describe("session tokens", () => {
  it("round-trips the user id", async () => {
    expect(await verifySession(await signSession("user_123"))).toBe("user_123");
  });
  it("rejects missing, garbage and tampered tokens", async () => {
    expect(await verifySession(undefined)).toBeNull();
    expect(await verifySession("not-a-token")).toBeNull();
    const t = await signSession("user_123");
    const [h, p, s] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "someone_else" })).toString("base64url");
    expect(await verifySession(`${h}.${forged}.${s}`)).toBeNull();
    expect(await verifySession(`${h}.${p}.${s.slice(0, -2)}xx`)).toBeNull();
  });
  it("rejects tokens signed with another secret", async () => {
    const other = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("user_123").setExpirationTime("1d")
      .sign(new TextEncoder().encode("another-secret-another-secret-another"));
    expect(await verifySession(other)).toBeNull();
  });
  it("rejects expired tokens", async () => {
    const secret = new TextEncoder().encode("dev-only-secret-change-me-dev-only-secret");
    const old = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u").setIssuedAt(1_000).setExpirationTime(2_000).sign(secret);
    expect(await verifySession(old)).toBeNull();
  });
  it("rejects alg=none", async () => {
    const none = `${Buffer.from('{"alg":"none"}').toString("base64url")}.${Buffer.from('{"sub":"u"}').toString("base64url")}.`;
    expect(await verifySession(none)).toBeNull();
  });
});
