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
async function fetchWithTimeout(resource: RequestInfo, options: RequestInit = {}, timeout = 8000) {
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
    try {
      const { userInfo, messages }: { userInfo: GeminiUserInfo; messages: GeminiChatMessage[] } = await req.json();
      if (!userInfo || !messages) {
        console.error('Missing userInfo or messages:', { userInfo, messages });
        return NextResponse.json({ success: false, error: 'Missing userInfo or messages.' }, { status: 400 });
      }
      if (!GEMINI_API_KEY) {
        console.error('GEMINI_API_KEY is not set');
        return NextResponse.json({ success: false, error: 'AI API key is not set.' }, { status: 500 });
      }
      // Prepare Gemini API request
      const geminiMessages = messages.map((m: GeminiChatMessage) => ({
        role: m.role === 'ai' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));
      const body = {
        contents: geminiMessages,
      };
      console.log('Sending to Gemini API:', JSON.stringify(body));
      // Use streaming endpoint with timeout
      let res;
      const maxAttempts = 2;
      let attempt = 0;
      while (attempt < maxAttempts) {
        try {
          res = await fetchWithTimeout(
            'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:streamGenerateContent?key=' + GEMINI_API_KEY,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            },
            60000 // 1 minute
          );
          break; // Success, exit loop
        } catch (err: unknown) {
          // Handle socket hang up (ECONNRESET)
          if (
            typeof err === 'object' && err !== null &&
            ('code' in err && (err as { code?: string }).code === 'ECONNRESET' ||
            'message' in err && (err as { message?: string }).message === 'socket hang up')
          ) {
            console.error('Gemini API ECONNRESET, retrying... attempt', attempt + 1);
            attempt++;
            if (attempt >= maxAttempts) {
              return NextResponse.json({ success: false, error: 'The AI service took too long to respond (connection reset). Please try again.' }, { status: 504 });
            }
            continue;
          }
          if (err && typeof err === 'object' && 'name' in err && (err as { name: string }).name === 'AbortError') {
            console.error('Gemini API request timed out');
            return NextResponse.json({ success: false, error: 'Gemini API request timed out.' }, { status: 504 });
          }
          console.error('Gemini API fetch error:', err);
          const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : String(err);
          return NextResponse.json({ success: false, error: 'Gemini API fetch error: ' + message }, { status: 502 });
        }
      }
      if (!res) {
        return NextResponse.json({ success: false, error: 'Gemini API request failed after retries.' }, { status: 504 });
      }
      console.log('Gemini API response status:', res.status);
      if (!res.body) {
        const text = await res.text().catch(() => '');
        console.error('No response body from Gemini:', res.status, text);
        return NextResponse.json({ success: false, error: `No response body from Gemini. Status: ${res.status}. Body: ${text}` }, { status: 500 });
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error('Gemini API error response:', res.status, text);
        return NextResponse.json({ success: false, error: `Gemini API error: Status ${res.status}. Body: ${text}` }, { status: res.status });
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
      console.error('Gemini API error (inner):', err);
      const message = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : String(err);
      return NextResponse.json({ error: 'Gemini API error (inner): ' + message }, { status: 500 });
    }
  } catch (err: unknown) {
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