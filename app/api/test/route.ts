import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ success: true, message: 'Test route is working!' });
}

export async function POST() {
  return NextResponse.json({ success: true, message: 'Test route POST is working!' });
} 