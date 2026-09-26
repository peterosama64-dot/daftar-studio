import { normalizeDigits } from "./heuristic";

/**
 * wa.me link for a phone number, or null. Egyptian local numbers (01xxxxxxxxx) get the 20 country code;
 * numbers already in international form (with + or 00) keep theirs.
 */
export function whatsappLink(phone: string): string | null {
  let d = normalizeDigits(phone).trim();
  const intl = d.startsWith("+") || d.startsWith("00");
  d = d.replace(/\D/g, "").replace(/^00/, "");
  if (!intl && /^01\d{9}$/.test(d)) d = "2" + d;
  return d.length >= 8 && d.length <= 15 ? `https://wa.me/${d}` : null;
}

export const clientHref = (name: string) => `/app/clients/${encodeURIComponent(name)}`;
