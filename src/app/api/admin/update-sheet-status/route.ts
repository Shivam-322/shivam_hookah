import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { z } from 'zod';
import { sheetdb } from '@/lib/sheetdb';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.split('Bearer ')[1];

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const ADMIN_EMAILS = [
      process.env.ADMIN_EMAIL_1,
      process.env.ADMIN_EMAIL_2,
    ].filter(Boolean);
    
    if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) {
      console.error('[admin] Unauthorized access attempt by:', decoded.email);
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const body = await req.json();
  const validation = z.object({
    orderId: z.string().min(1, 'orderId required').max(100),
    status: z.string().min(1, 'status required').max(50),
  }).safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: "Invalid request", details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { orderId, status } = validation.data;

  try {
    await sheetdb.updateOrderStatus(orderId, {
      orderStatus: status.charAt(0).toUpperCase() + status.slice(1),
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[update-sheet-status]', err);
    return NextResponse.json({ error: 'Sheet update failed' }, { status: 500 });
  }
}
