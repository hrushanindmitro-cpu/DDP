import nodemailer from "nodemailer";

// Generic SMTP sender (Brevo, or any other provider). Credentials come only from environment variables.
// It never throws and never reports success when nothing was sent.
export function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
}

export async function sendMail({ to, subject, text }) {
  if (!isMailConfigured()) return { ok: false, error: "not_configured" };
  try {
    const port = Number(process.env.SMTP_PORT || 587);
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000
    });
    await transport.sendMail({ from: process.env.MAIL_FROM, to, subject, text });
    return { ok: true };
  } catch (e) {
    console.error("mail send failed:", e?.code || e?.message || "unknown"); // no credentials, no message body
    return { ok: false, error: "send_failed" };
  }
}
