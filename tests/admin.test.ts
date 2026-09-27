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

import { adminStats, humanBytes, lastSeen } from "../src/lib/admin-stats";

describe("admin stats", () => {
  const at = new Date("2026-09-27T12:00:00Z");
  const ago = (days: number) => new Date(at.getTime() - days * 86_400_000);
  const u = (created: number, seen: number | null, extra = {}) => ({ createdAt: ago(created), lastSeenAt: seen === null ? null : ago(seen), suspendedAt: null, tasks: 2, entries: 3, files: 1, bytes: 1000, ...extra });
  it("counts new, active and suspended accounts and sums usage", () => {
    const s = adminStats([u(5, 0.2), u(40, 3), u(100, 20, { suspendedAt: ago(1) }), u(1, null)], at);
    expect(s).toEqual({ users: 4, new30: 2, active1: 1, active7: 2, suspended: 1, tasks: 8, entries: 12, files: 4, bytes: 4000 });
  });
  it("formats bytes", () => {
    expect(humanBytes(0)).toBe("0");
    expect(humanBytes(2048)).toBe("2 KB");
    expect(humanBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(humanBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });
  it("says how long ago in Egyptian Arabic", () => {
    expect(lastSeen(null, at)).toBe("لسه متسجّلش نشاط");
    expect(lastSeen(ago(0.5), at)).toBe("النهارده");
    expect(lastSeen(ago(1.5), at)).toBe("امبارح");
    expect(lastSeen(ago(2.2), at)).toBe("من يومين");
    expect(lastSeen(ago(5), at)).toBe("من 5 أيام");
    expect(lastSeen(ago(15), at)).toBe("من 15 يوم");
    expect(lastSeen(ago(35), at)).toBe("من شهر");
    expect(lastSeen(ago(65), at)).toBe("من شهرين");
    expect(lastSeen(ago(100), at)).toBe("من 3 شهور");
  });
});
