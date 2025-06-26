import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { nanoid } from 'nanoid';

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, category } = await req.json();
    const errors: { [key: string]: string } = {};
    if (!name || typeof name !== 'string' || !name.trim()) errors.name = 'Full name is required.';
    if (!email || typeof email !== 'string' || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'Valid email is required.';
    if (!phone || typeof phone !== 'string' || !phone.trim()) errors.phone = 'Phone number is required.';
    if (!category || typeof category !== 'string' || !category.trim()) errors.category = 'Category is required.';
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ success: false, errors }, { status: 400 });
    }
    const db = await getDb();
    const ticketId = nanoid(10);
    const ticket = {
      ticketId,
      name,
      email,
      phone,
      category,
      status: 'open',
      createdAt: new Date(),
    };
    await db.collection('tickets').insertOne(ticket);
    return NextResponse.json({
      success: true,
      ticketId,
      data: { name, email, phone, category },
      ai: { category, questions: [] },
    });
  } catch (err) {
    console.error('API Error in /ticket/initiate:', err);
    const errorMessage = err instanceof Error ? err.message : 'An unknown server error occurred.';
    return NextResponse.json({ success: false, error: 'Server error.', details: errorMessage }, { status: 500 });
  }
} 