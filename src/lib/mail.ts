// Sending email through Resend (https://resend.com). Needs RESEND_API_KEY and MAIL_FROM
// (e.g. "دفتر الاستوديو <hello@yourdomain.com>", a sender on a domain verified in Resend).
// RESEND_API_URL only exists for local testing against a stand-in server.
export const mailConfigured = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

export async function sendMail(m: { to: string; subject: string; html: string; text: string; attachments?: { filename: string; content: string }[] }): Promise<{ ok: boolean; error?: string }> {
  if (!mailConfigured()) return { ok: false, error: "not_configured" };
  try {
    const res = await fetch(process.env.RESEND_API_URL || "https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${process.env.RESEND_API_KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text, ...(m.attachments ? { attachments: m.attachments } : {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) { console.error("sendMail: Resend", res.status); return { ok: false, error: `status_${res.status}` }; }
    return { ok: true };
  } catch (e) {
    console.error("sendMail:", e instanceof Error ? e.message : e);
    return { ok: false, error: "network" };
  }
}
