import { db } from "@/server/db";
import { getIntegrations } from "@/server/integrations";

type Email = { to: string; subject: string; html: string; text: string; template: string; userId?: string | null };

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Minimal branded layout for transactional email. All interpolated values must be escaped by the caller via `esc`. */
export function emailLayout(title: string, bodyHtml: string) {
  return `<!doctype html><html><body style="margin:0;background:#0b0b0f;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#eaeaf0">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#15151c;border-radius:16px;padding:32px">
<tr><td style="font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:#f0506e;padding-bottom:16px">The Otaku Bazaar</td></tr>
<tr><td style="font-size:22px;font-weight:600;padding-bottom:16px">${escapeHtml(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6;color:#c8c8d2">${bodyHtml}</td></tr>
</table></td></tr></table></body></html>`;
}

export const esc = escapeHtml;

export function button(href: string, label: string) {
  return `<p style="padding:16px 0"><a href="${escapeHtml(href)}" style="background:#f0506e;color:#fff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600">${escapeHtml(label)}</a></p>`;
}

/**
 * Sends through Resend when RESEND_API_KEY is set. Without it (development), the email is printed to the
 * server console so links can be followed. Every attempt is recorded in the Notification table.
 */
export async function sendEmail(email: Email): Promise<boolean> {
  const integ = await getIntegrations();
  const key = integ.resendApiKey;
  const record = await db.notification.create({
    data: {
      userId: email.userId ?? null,
      channel: "EMAIL",
      template: email.template,
      recipient: email.to,
      subject: email.subject,
      body: email.text,
    },
  });

  if (!key) {
    if (process.env.NODE_ENV === "production") {
      await db.notification.update({ where: { id: record.id }, data: { status: "SKIPPED", error: "Email not set up (Admin → Integrations)" } });
      console.error(`[email] Email is not set up in Admin → Integrations; "${email.subject}" to ${email.to} was not sent`);
      return false;
    }
    console.info(`\n[email:dev] To: ${email.to}\nSubject: ${email.subject}\n${email.text}\n`);
    await db.notification.update({ where: { id: record.id }, data: { status: "SENT", sentAt: new Date() } });
    return true;
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": record.id },
      body: JSON.stringify({
        from: integ.mailFrom,
        to: [email.to],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!res.ok) throw new Error(`Resend responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
    await db.notification.update({ where: { id: record.id }, data: { status: "SENT", sentAt: new Date() } });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.notification.update({ where: { id: record.id }, data: { status: "FAILED", error: message } });
    console.error("[email] send failed", message);
    return false;
  }
}
