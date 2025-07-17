import { NextRequest, NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

interface OpenAIUserInfo {
  name: string;
  email: string;
  phone: string;
  category: string;
  message: string;
}

interface OpenAIChatMessage {
  role: 'user' | 'ai';
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userInfo, messages }: { userInfo: OpenAIUserInfo; messages: OpenAIChatMessage[] } = await req.json();
    if (!userInfo || !messages) {
      return NextResponse.json({ success: false, error: 'Missing userInfo or messages.' }, { status: 400 });
    }
    if (!OPENAI_API_KEY) {
      return NextResponse.json({ success: false, error: 'OpenAI API key is not set.' }, { status: 500 });
    }
    // Prepare OpenAI API request
    const openaiMessages = messages.map((m: OpenAIChatMessage) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));
    const body = {
      model: 'gpt-3.5-turbo',
      messages: openaiMessages,
      temperature: 0.7,
      max_tokens: 512,
    };
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ success: false, error: `OpenAI API error: Status ${res.status}. Body: ${text}` }, { status: res.status });
    }
    const data = await res.json();
    const aiReply = data.choices?.[0]?.message?.content || '';
    return NextResponse.json({ success: true, ai: aiReply });
  } catch (err: unknown) {
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : String(err);
    return NextResponse.json({ success: false, error: 'OpenAI API error: ' + message }, { status: 500 });
  }
} 