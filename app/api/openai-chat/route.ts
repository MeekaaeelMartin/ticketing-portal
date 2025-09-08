import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    { success: false, error: 'OpenAI chat endpoint is disabled in this deployment.' },
    { status: 501 }
  );
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: 'OpenAI chat endpoint is disabled in this deployment.' },
    { status: 404 }
  );
}

