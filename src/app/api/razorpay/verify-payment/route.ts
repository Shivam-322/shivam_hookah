import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import crypto from 'crypto';
import { createOrder } from '@/lib/orders/createOrder';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1'; // Mumbai — closest to Shiprocket
export const maxDuration = 30;         // 30 seconds

export async function POST(req: NextRequest) {
  // Step 1 — Verify Firebase auth token
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.split('Bearer ')[1];

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let decodedToken: any;
  try {
    decodedToken = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  // Step 2 — Parse request body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const {
    razorpayOrderId,      // from Razorpay: order_xxx
    razorpayPaymentId,    // from Razorpay: pay_xxx
    razorpaySignature,    // from Razorpay: signature string
    shippingAddress,
    items,
    total,
  } = body;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    return NextResponse.json(
      { error: 'Missing payment verification fields' },
      { status: 400 }
    );
  }

  // Step 3 — Verify Razorpay signature (CRITICAL security check)
  // This proves the payment actually happened on Razorpay's servers
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpayOrderId}|${razorpayPaymentId}`)
    .digest('hex');

  if (expectedSignature !== razorpaySignature) {
    console.error('[verify-payment] Signature mismatch — possible tampering');
    return NextResponse.json(
      { error: 'Payment verification failed' },
      { status: 400 }
    );
  }

  console.log('[verify-payment] Signature verified');

  // Step 4 — Create order via shared transactional helper
  // The transaction inside createOrder() prevents duplicate orders
  // even if the webhook fires at the same time.
  try {
    const result = await createOrder({
      razorpayOrderId,
      razorpayPaymentId,
      total,
      items: items || [],
      shippingAddress: {
        name: shippingAddress?.name || '',
        phone: shippingAddress?.phone || '',
        line1: shippingAddress?.line1 || '',
        city: shippingAddress?.city || '',
        state: shippingAddress?.state || '',
        pincode: shippingAddress?.pincode || '',
      },
      userId: decodedToken.uid,
      userEmail: decodedToken.email || '',
      userName: shippingAddress?.name || '',
    });

    if (result.alreadyExisted) {
      console.log('[verify-payment] ⚠️ Order already existed (webhook won the race)');
    } else {
      console.log('[verify-payment] ✅ Order created');
    }

    return NextResponse.json({
      success: true,
      orderId: result.orderId,
      duplicate: result.alreadyExisted,
    });

  } catch (err) {
    console.error('[verify-payment] Order creation failed:', err);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
