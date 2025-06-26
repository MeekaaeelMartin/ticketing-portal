import { NextRequest, NextResponse } from 'next/server';
import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@yourdomain.com';
const EMAIL_TO = 'meekaaeel@tecbot.co.za';

if (!SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY not set');
sgMail.setApiKey(SENDGRID_API_KEY);

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
    const { userInfo, transcript }: { userInfo: EscalateUserInfo; transcript: EscalateTranscriptItem[] } = await req.json();
    if (!userInfo || !transcript) {
      return NextResponse.json({ success: false, error: 'Missing userInfo or transcript.' }, { status: 400 });
    }
    const subject = `Escalated Support Ticket from ${userInfo.name}`;
    const html = `
      <h2>Escalated Support Ticket</h2>
      <p><b>Name:</b> ${userInfo.name}</p>
      <p><b>Email:</b> ${userInfo.email}</p>
      <p><b>Phone:</b> ${userInfo.phone}</p>
      <p><b>Category:</b> ${userInfo.category}</p>
      <p><b>Original Message:</b> ${userInfo.message}</p>
      <h3>Chat Transcript</h3>
      <div style="background:#f5f6fa;padding:12px;border-radius:8px;">
        ${transcript.map((m: any) => `<div><b>${m.role === 'user' ? 'Client' : 'AI'}:</b> ${m.content}</div>`).join('')}
      </div>
    `;
    await sgMail.send({
      to: EMAIL_TO,
      from: EMAIL_FROM,
      subject,
      html,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to escalate.', details: error?.message || String(error) }, { status: 500 });
  }
} 