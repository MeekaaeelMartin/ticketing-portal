import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@yourdomain.com';
const EMAIL_TO = 'meekaaeel@tecbot.co.za';

// Configure SendGrid lazily to avoid throwing during module import
function ensureSendgridConfigured(): { ok: boolean; error?: string } {
  if (!SENDGRID_API_KEY) {
    return { ok: false, error: 'SENDGRID_API_KEY is not set' };
  }
  try {
    sgMail.setApiKey(SENDGRID_API_KEY);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

interface EscalateUserInfo {
  name: string;
  email: string;
  phone: string;
  category: string;
  message: string;
}

interface EscalateTranscriptItem {
  role: 'user' | 'ai';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const cfg = ensureSendgridConfigured();
    if (!cfg.ok) {
      return NextResponse.json({ success: false, error: cfg.error }, { status: 500 });
    }
    const { userInfo, transcript, urgency }: { userInfo: EscalateUserInfo; transcript: EscalateTranscriptItem[]; urgency?: string } = await req.json();
    if (!userInfo || !transcript) {
      return NextResponse.json({ success: false, error: 'Missing userInfo or transcript.' }, { status: 400 });
    }
    const subject = `Escalated Support Ticket from ${userInfo.name}`;
    const html = `
      <h2>Escalated Support Ticket</h2>
      ${urgency === 'urgent' ? '<p style="color:#ff2222;font-weight:bold;font-size:18px;">URGENT</p>' : ''}
      <p><b>Name:</b> ${userInfo.name}</p>
      <p><b>Email:</b> ${userInfo.email}</p>
      <p><b>Phone:</b> ${userInfo.phone}</p>
      <p><b>Category:</b> ${userInfo.category}</p>
      <p><b>Original Message:</b> ${userInfo.message}</p>
      <h3>Chat Transcript</h3>
      <div style="background:#f5f6fa;padding:12px;border-radius:8px;">
        ${transcript.map((m: EscalateTranscriptItem) => `<div><b>${m.role === 'user' ? 'Client' : 'AI'}:</b> ${m.content}</div>`).join('')}
      </div>
    `;
    try {
      await sgMail.send({
        to: EMAIL_TO,
        from: EMAIL_FROM,
        subject,
        html,
      });
    } catch (err: unknown) {
      // Normalize SendGrid errors
      type SendgridErrorShape = { code?: number; response?: { statusCode?: number; body?: unknown }; message?: unknown };
      const sgErr = err as SendgridErrorShape;
      const status = sgErr?.response?.statusCode || sgErr?.code || 500;
      const details = sgErr?.response?.body ? JSON.stringify(sgErr.response.body) : '';
      const message = status === 401
        ? 'Unauthorized: Check SENDGRID_API_KEY is valid and has Mail send permission.'
        : (typeof sgErr?.message === 'string' ? sgErr.message : String(err));
      return NextResponse.json({ success: false, error: message, details }, { status: typeof status === 'number' ? status : 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('API error:', err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? (err.stack || err.message) : String(err),
      },
      { status: 500 }
    );
  }
} 