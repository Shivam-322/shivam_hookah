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
    if (!decoded.admin) {
      console.error('[admin] Unauthorized access attempt by:', decoded.email);
      return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
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
