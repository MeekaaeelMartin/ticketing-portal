import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyDtRGZREmqgOmcWiVLJFoW4nhJi4rLx4p8';

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

export async function POST(req: NextRequest) {
  try {
    const { userInfo, messages }: { userInfo: GeminiUserInfo; messages: GeminiChatMessage[] } = await req.json();
    if (!userInfo || !messages) {
      console.error('Missing userInfo or messages:', { userInfo, messages });
      return NextResponse.json({ success: false, error: 'Missing userInfo or messages.' }, { status: 400 });
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
    // Use streaming endpoint
    const res = await fetch('https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:streamGenerateContent?key=' + GEMINI_API_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    console.log('Gemini API response status:', res.status);
    if (!res.body) {
      console.error('No response body from Gemini:', res.status, await res.text());
      return NextResponse.json({ success: false, error: 'No response body from Gemini.' }, { status: 500 });
    }
    // Stream the response to the client
    return new Response(res.body, {
      headers: {
        'Content-Type': res.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (err) {
    console.error('Gemini API error:', err);
    return NextResponse.json({ error: 'AI error', details: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
} 