import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@yourdomain.com';

if (!SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY not set');
sgMail.setApiKey(SENDGRID_API_KEY);

export async function sendTicketNotification({ to, subject, html, text }: { to: string, subject: string, html: string, text?: string }) {
  const msg = {
    to,
    from: EMAIL_FROM,
    subject,
    html,
    text,
  };
  await sgMail.send(msg);
} 