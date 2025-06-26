import { NextRequest, NextResponse } from 'next/server';
import { sendTicketNotification } from '@/lib/email';

const STAFF_EMAIL = 'meekaaeel@tecbot.co.za';

export async function POST(req: NextRequest) {
  try {
    const { userInfo, review } = await req.json();
    if (!userInfo || !review) {
      return NextResponse.json({ success: false, error: 'Missing userInfo or review.' }, { status: 400 });
    }
    const subject = `New Support Review from ${userInfo.name}`;
    const html = `
      <h2>New Support Review</h2>
      <p><b>Name:</b> ${userInfo.name}</p>
      <p><b>Email:</b> ${userInfo.email}</p>
      <p><b>Phone:</b> ${userInfo.phone}</p>
      <p><b>Category:</b> ${userInfo.category}</p>
      <p><b>Original Message:</b> ${userInfo.message}</p>
      <h3>Review</h3>
      <p><b>Rating:</b> ${review.rating} / 5</p>
      <p><b>Comment:</b> ${review.comment}</p>
    `;
    await sendTicketNotification({
      to: STAFF_EMAIL,
      subject,
      html,
    });
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Failed to send review.', details: message }, { status: 500 });
  }
} 