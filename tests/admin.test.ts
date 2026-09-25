import { describe, it, expect } from "vitest";
import { isAdminEmail, parseAdminEmails } from "../src/lib/admin-emails";

describe("admin emails", () => {
  it("parses comma/space separated, lowercases, drops junk", () => {
    expect([...parseAdminEmails(" A@x.com, b@y.org  c@z.io,,notanemail ")]).toEqual(["a@x.com", "b@y.org", "c@z.io"]);
  });
  it("matches case-insensitively", () => {
    expect(isAdminEmail("A@X.com", "a@x.com")).toBe(true);
    expect(isAdminEmail(" a@x.com ", "a@x.com")).toBe(true);
  });
  it("nobody is admin when unset or empty", () => {
    expect(isAdminEmail("a@x.com", undefined)).toBe(false);
    expect(isAdminEmail("a@x.com", "")).toBe(false);
    expect(isAdminEmail(null, "a@x.com")).toBe(false);
    expect(isAdminEmail("", "a@x.com")).toBe(false);
  });
  it("does not match on a substring", () => {
    expect(isAdminEmail("a@x.co", "a@x.com")).toBe(false);
    expect(isAdminEmail("xa@x.com", "a@x.com")).toBe(false);
  });
});
