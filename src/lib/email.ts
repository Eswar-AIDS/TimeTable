import nodemailer from 'nodemailer';
import { loadEnv } from './env';

const env = loadEnv();

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS } = env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  return transporter;
}

export async function sendAdminEmail(subject: string, message: string): Promise<void> {
  const tx = getTransporter();
  const to = env.ADMIN_EMAIL;
  const from = env.FROM_EMAIL || env.ADMIN_EMAIL || env.SMTP_USER || 'no-reply@example.com';
  if (!to) {
    // eslint-disable-next-line no-console
    console.warn('[email] ADMIN_EMAIL not set; skipping email notification');
    return;
  }
  if (!tx) {
    // eslint-disable-next-line no-console
    console.warn('[email] SMTP not configured (check SMTP_HOST/PORT/USER/PASS); skipping email notification');
    return;
  }
  try {
    await tx.sendMail({ to, from, subject, text: message });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Failed to send admin email:', err);
  }
}


