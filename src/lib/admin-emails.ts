// Admins are listed in the ADMIN_EMAILS env var (comma-separated), never in code:
// the repo is public. Pure so it can be unit-tested.
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set((raw ?? "").split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => e.includes("@")));
}

export const isAdminEmail = (email: string | null | undefined, raw = process.env.ADMIN_EMAILS) =>
  !!email && parseAdminEmails(raw).has(email.trim().toLowerCase());
