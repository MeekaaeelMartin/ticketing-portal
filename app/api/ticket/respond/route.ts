import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { getDb } from '@/lib/mongodb';
import { sendTicketNotification } from '@/lib/email';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a professional, friendly Support-Triage Assistant for a technology company. When given a user's initial support request and their selected category, your job is to:
- Politely and concisely ask up to 3 clarifying questions, only if absolutely necessary, to diagnose the issue.
- Never ask for information the user has already provided.
- End the conversation with a friendly closing when you have all the information you need (e.g., "Thank you, that's all I need for now. Our team will follow up soon.").
- If the user says "no" or "that's all", end the chat politely.
- Keep your responses short and clear.
- Do not answer questions unrelated to support triage.
- Always reply as the assistant in a helpful, concise, and professional way.`;

const STAFF_EMAIL = 'meekaaeel@tecbot.co.za';

interface TicketRespondMessage {
  role: 'user' | 'ai';
  content: string;
}

type OpenAIChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export async function POST(req: NextRequest) {
  try {
    const { ticketId, response }: { ticketId: string; response: TicketRespondMessage[] } = await req.json();
    if (!ticketId || typeof ticketId !== 'string') {
      return NextResponse.json({ success: false, error: 'ticketId is required.' }, { status: 400 });
    }
    if (!Array.isArray(response)) {
      return NextResponse.json({ success: false, error: 'Messages array required.' }, { status: 400 });
    }
    const db = await getDb();
    // Save the latest user message (if any new)
    const lastMsg = response[response.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      await db.collection('ticket_messages').insertOne({
        ticketId,
        role: 'user',
        message: lastMsg.content,
        timestamp: new Date(),
      });
    }
    // Prepare messages for OpenAI
    const chatMessages: OpenAIChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...response.map((m: TicketRespondMessage) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content
      } as OpenAIChatMessage)),
    ];
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: chatMessages,
      temperature: 0.2,
      max_tokens: 400,
    });
    const aiMessage = completion.choices[0].message.content || '';
    // Save the assistant's reply
    await db.collection('ticket_messages').insertOne({
      ticketId,
      role: 'assistant',
      message: aiMessage,
      timestamp: new Date(),
    });
    // Heuristic: If AI says "Thank you" or similar, mark as done
    const done = /no further questions|that is all|thank you|i have all the information|our team will follow up soon|that's all/i.test(aiMessage);
    if (done) {
      // Fetch ticket and all messages
      const ticket = await db.collection('tickets').findOne({ ticketId });
      const transcript = await db.collection('ticket_messages')
        .find({ ticketId })
        .sort({ timestamp: 1 })
        .toArray();
      // Compose email
      const subject = `New Support Ticket [${ticketId}] - ${ticket?.category || ''}`;
      const html = `
        <h2>New Support Ticket</h2>
        <p><b>Ticket ID:</b> ${ticketId}</p>
        <p><b>Name:</b> ${ticket?.name || ''}</p>
        <p><b>Email:</b> ${ticket?.email || ''}</p>
        <p><b>Phone:</b> ${ticket?.phone || ''}</p>
        <p><b>Category:</b> ${ticket?.category || ''}</p>
        <p><b>Status:</b> ${ticket?.status || ''}</p>
        <p><b>Created At:</b> ${ticket?.createdAt ? new Date(ticket.createdAt).toLocaleString() : ''}</p>
        <h3>Conversation Transcript</h3>
        <div style="background:#f5f6fa;padding:12px;border-radius:8px;">
          ${transcript.map(m => `<div><b>${m.role === 'user' ? 'Client' : 'Assistant'}:</b> ${m.message}</div>`).join('')}
        </div>
      `;
      try {
        await sendTicketNotification({
          to: STAFF_EMAIL,
          subject,
          html,
        });
      } catch (emailErr) {
        // Log but don't fail the API
        console.error('Failed to send ticket notification:', emailErr);
      }
    }
    return NextResponse.json({
      success: true,
      next: {
        role: 'assistant',
        message: aiMessage,
        done,
      },
      messages: response,
    });
  } catch (err) {
    console.error('API Error in /ticket/respond:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown server error occurred.';
    return NextResponse.json({ success: false, error: 'Server error.', details: errorMessage }, { status: 500 });
  }
} 