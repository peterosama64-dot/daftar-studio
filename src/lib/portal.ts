import "server-only";
import { prisma } from "./db";
import { isToken } from "./share";
import { CURRENCIES } from "./constants";
import { PARTY_SELECT } from "./party";

/**
 * The client behind a portal link, with the owner's public details. Null for a bad, turned-off or
 * suspended-account link. Everything the portal shows is then scoped to this owner + client name.
 */
export async function portalFor(token: string) {
  if (!isToken(token)) return null;
  const info = await prisma.clientInfo.findUnique({
    where: { portalToken: token, user: { suspendedAt: null } },
    select: { userId: true, name: true, user: { select: { ...PARTY_SELECT, currency: true } } },
  });
  if (!info) return null;
  return { ...info, cur: CURRENCIES.find((c) => c.code === info.user.currency)?.short ?? "ج.م" };
}
