import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface UserInfo {
  name: string;
  email: string;
  phone: string;
  category: string;
  message: string;
}

interface ChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userInfo, messages }: { userInfo: UserInfo; messages: ChatMessage[] } = await req.json();
    if (!userInfo || !messages) {
      return NextResponse.json({ success: false, error: 'Missing userInfo or messages.' }, { status: 400 });
    }
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'OPENAI_API_KEY is not set.' }, { status: 500 });
    }

    const systemPrompt = `You are a helpful IT support assistant. Be concise and helpful.`;
    const oaiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m) => ({ role: m.role === 'ai' ? 'assistant' as const : 'user' as const, content: m.content })),
    ];

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 12000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: oaiMessages,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });
    clearTimeout(id);

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      // Clearer auth errors
      if (res.status === 401 || /unauthorized|invalid api key/i.test(text)) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: check OPENAI_API_KEY in env and redeploy.', details: text },
          { status: 401 }
        );
      }
      return NextResponse.json({ success: false, error: `OpenAI API error: ${res.status}`, details: text }, { status: res.status });
    }

    const data = await res.json();
    const aiContent: string = data?.choices?.[0]?.message?.content || '';
    if (!aiContent) {
      return NextResponse.json({ success: false, error: 'AI did not return a response.', details: JSON.stringify(data).slice(0, 2000) }, { status: 502 });
    }

    return NextResponse.json({ success: true, answer: aiContent });
  } catch (err: unknown) {
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : String(err);
    const isAbort = /aborted|AbortError|timeout/i.test(message);
    return NextResponse.json({ success: false, error: isAbort ? 'OpenAI request timed out.' : 'OpenAI error: ' + message }, { status: isAbort ? 504 : 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'OpenAI chat endpoint is disabled in this deployment.' },
    { status: 404 }
  );
}

