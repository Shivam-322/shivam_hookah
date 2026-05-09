import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createOrder } from '@/lib/orders/createOrder';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1'; // Mumbai
export const maxDuration = 30;

/**
 * Razorpay Webhook Handler — Safety Net
 *
 * This route is called by Razorpay's servers when a payment event occurs.
 * It exists purely as a reliability backup for cases where the user's
 * browser disconnects after paying but before /verify-payment completes.
 *
 * Auth: Razorpay HMAC signature (x-razorpay-signature header).
 *       NO Firebase auth token — Razorpay's servers don't have one.
 *
 * Idempotency: The shared createOrder() helper uses a Firestore
 *              transaction, so even if verify-payment AND this webhook
 *              fire at the same instant, only one order is created.
 */
export async function POST(req: NextRequest) {
  // ── 1. Read raw body FIRST (before any parsing) ─────────────────────────
  const rawBody = await req.text();

  // ── 2. Verify Razorpay webhook signature ────────────────────────────────
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('[webhook] RAZORPAY_WEBHOOK_SECRET is not configured');
    // Return 200 to stop Razorpay from retrying — this is a config issue
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 200 });
  }

  const receivedSignature = req.headers.get('x-razorpay-signature') || '';

  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  if (expectedSignature !== receivedSignature) {
    console.error('[webhook] ❌ Signature mismatch — rejecting request');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // ── 3. Parse the event ──────────────────────────────────────────────────
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    console.error('[webhook] Failed to parse event body');
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType: string = event.event;
  console.log('[webhook] Received event:', eventType);

  // Only process payment.captured — acknowledge everything else with 200
  if (eventType !== 'payment.captured') {
    return NextResponse.json({ status: 'ignored', event: eventType });
  }

  // ── 4. Extract payment fields ───────────────────────────────────────────
  const paymentEntity = event.payload?.payment?.entity;

  if (!paymentEntity) {
    console.error('[webhook] Missing payment entity in payload');
    return NextResponse.json({ error: 'Missing payment entity' }, { status: 200 });
  }

  const razorpayPaymentId: string = paymentEntity.id;
  const razorpayOrderId: string = paymentEntity.order_id;

  if (!razorpayPaymentId || !razorpayOrderId) {
    console.error('[webhook] Missing payment or order ID');
    return NextResponse.json({ error: 'Missing IDs' }, { status: 200 });
  }

  console.log('[webhook] Processing payment.captured event');

  // ── 5. Fetch authoritative order data from Razorpay API ─────────────────
  //    The notes contain items + shipping address stored during create-order
  try {
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });

    const razorpayOrder = await razorpay.orders.fetch(razorpayOrderId);
    const notes = razorpayOrder.notes as Record<string, string>;

    // Parse items from the notes (stored as JSON string in create-order)
    let items: any[] = [];
    try {
      items = JSON.parse(notes.items || '[]');
    } catch {
      console.error('[webhook] Failed to parse items from Razorpay notes');
      return NextResponse.json({ error: 'Invalid items in order notes' }, { status: 500 });
    }

    const totalInRupees = Number(razorpayOrder.amount) / 100;

    const shippingAddress = {
      name: notes.shippingName || notes.userName || '',
      phone: notes.shippingPhone || '',
      line1: notes.shippingLine1 || '',
      city: notes.shippingCity || '',
      state: notes.shippingState || '',
      pincode: notes.shippingPincode || '',
    };

    // ── 6. Create order via shared transactional helper ──────────────────
    const result = await createOrder({
      razorpayOrderId,
      razorpayPaymentId,
      total: totalInRupees,
      items,
      shippingAddress,
      userId: notes.userId || '',
      userEmail: notes.userEmail || '',
      userName: notes.userName || notes.shippingName || '',
    });

    if (result.alreadyExisted) {
      console.log('[webhook] ✅ Order already existed (verify-payment won the race)');
    } else {
      console.log('[webhook] ✅ Order created by webhook (browser missed)');
    }

    return NextResponse.json({
      status: 'ok',
      orderId: result.orderId,
      alreadyExisted: result.alreadyExisted,
    });

  } catch (err) {
    console.error('[webhook] ❌ Failed to process payment.captured:', err);
    // Return 500 so Razorpay retries — this is a transient failure
    return NextResponse.json(
      { error: 'Internal processing error' },
      { status: 500 }
    );
  }
}
