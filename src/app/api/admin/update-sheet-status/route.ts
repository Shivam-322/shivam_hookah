import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
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
    const adminEmails = [
      process.env.NEXT_PUBLIC_ADMIN_EMAIL_1,
      process.env.NEXT_PUBLIC_ADMIN_EMAIL_2,
    ];
    if (!adminEmails.includes(decoded.email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { orderId, status } = await req.json();

  if (!orderId || !status) {
    return NextResponse.json(
      { error: 'orderId and status required' },
      { status: 400 }
    );
  }

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
