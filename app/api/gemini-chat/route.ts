import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface GeminiUserInfo {
  name: string;
  email: string;
  phone: string;
  category: string;
  message: string;
}

interface GeminiChatMessage {
  role: 'user' | 'ai';
  content: string;
}

// Helper to add timeout to fetch
async function fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, { ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { userInfo, messages }: { userInfo: GeminiUserInfo; messages: GeminiChatMessage[] } = await req.json();
    if (!userInfo || !messages) {
      return NextResponse.json({ success: false, error: 'Missing userInfo or messages.' }, { status: 400 });
    }
    if (!GEMINI_API_KEY) {
      return NextResponse.json({ success: false, error: 'Gemini API key is not set.' }, { status: 500 });
    }
    // Prepare Gemini API request
    const geminiMessages = messages.map((m: GeminiChatMessage) => ({
      role: m.role === 'ai' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const body = {
      contents: geminiMessages,
    };
    const res = await fetchWithTimeout(
      'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:streamGenerateContent?key=' + GEMINI_API_KEY,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
      15000 // 15 seconds
    );
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ success: false, error: `Gemini API error: Status ${res.status}. Body: ${text}` }, { status: res.status });
    }
    if (!res.body) {
      const text = await res.text().catch(() => '');
      return NextResponse.json({ success: false, error: `No response body from Gemini. Status: ${res.status}. Body: ${text}` }, { status: 500 });
    }
    // Stream the response to the client
    return new Response(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err: unknown) {
    const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : String(err);
    return NextResponse.json({ success: false, error: 'Gemini API error: ' + message }, { status: 500 });
  }
} 