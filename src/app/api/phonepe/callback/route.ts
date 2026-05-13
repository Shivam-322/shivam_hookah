import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { verifyChecksum, generateStatusChecksum } from '@/lib/phonepe';
import { createOrder } from '@/lib/orders/createOrder';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

/**
 * PhonePe Server-to-Server Callback Handler — Safety Net
 *
 * This route is called by PhonePe servers when a payment event occurs.
 * It exists as a reliability backup in case the redirect fails
 * (e.g., user closes browser after paying).
 *
 * Auth: PhonePe checksum verification.
 *       NO Firebase auth token — PhonePe servers don't have one.
 *
 * IMPORTANT: Always return 200 after checksum verification.
 * PhonePe retries for 24 hours on non-200 responses.
 */
export async function POST(req: NextRequest) {
  const saltKey = process.env.PHONEPE_SALT_KEY!;
  const saltIndex = process.env.PHONEPE_SALT_INDEX!;

  // ── 1. Read response from body ─────────────────────────────────────────────
  let responseBase64 = '';
  let receivedChecksum = '';

  try {
    const body = await req.json();
    responseBase64 = body.response || '';
    receivedChecksum = body.checksum || '';
  } catch {
    // Fallback: try form data
    try {
      const rawBody = await req.text();
      const params = new URLSearchParams(rawBody);
      responseBase64 = params.get('response') || '';
      receivedChecksum = params.get('checksum') || '';
    } catch {
      console.error('[phonepe-callback] Failed to parse request body');
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
  }

  if (!responseBase64) {
    console.error('[phonepe-callback] Missing response in callback');
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // ── 2. Verify checksum ──────────────────────────────────────────────────────
  if (receivedChecksum) {
    const isValid = verifyChecksum(responseBase64, receivedChecksum, saltKey, saltIndex);

    if (!isValid) {
      console.error('[phonepe-callback] ❌ Checksum verification failed');
      return NextResponse.json({ error: 'Invalid checksum' }, { status: 400 });
    }
  }

  // ── 3. Decode response ──────────────────────────────────────────────────────
  let decoded: any;
  try {
    decoded = JSON.parse(Buffer.from(responseBase64, 'base64').toString('utf-8'));
  } catch {
    console.error('[phonepe-callback] Failed to decode base64 response');
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  console.log('[phonepe-callback] Received callback. Code:', decoded.code);

  // ── 4. Check payment status ─────────────────────────────────────────────────
  if (decoded.code !== 'PAYMENT_SUCCESS') {
    console.log('[phonepe-callback] Payment not successful:', decoded.code);

    // Update pending order to failed
    const txnId = decoded.data?.merchantTransactionId;
    if (txnId) {
      try {
        await adminDb.collection('orders').doc(txnId).update({
          status: 'payment_failed',
          'payment.status': 'failed',
          'payment.failureCode': decoded.code || 'UNKNOWN',
          'payment.failureMessage': decoded.message || '',
        });
      } catch {
        // Pending order might not exist
      }
    }

    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  const merchantTransactionId = decoded.data?.merchantTransactionId;
  const paidAmountPaise = decoded.data?.amount;
  const phonePeTransactionId = decoded.data?.transactionId || '';

  if (!merchantTransactionId) {
    console.error('[phonepe-callback] Missing merchantTransactionId');
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // ── 5. Verify payment via status check API (extra security) ─────────────────
  try {
    const merchantId = process.env.PHONEPE_MERCHANT_ID!;
    const statusEndpoint = `/pg/v1/status/${merchantId}/${merchantTransactionId}`;
    const statusChecksum = generateStatusChecksum(statusEndpoint, saltKey, saltIndex);

    const statusRes = await fetch(
      `${process.env.PHONEPE_BASE_URL}${statusEndpoint}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': statusChecksum,
          'X-MERCHANT-ID': merchantId,
        },
      }
    );

    const statusData = await statusRes.json();

    if (statusData.code !== 'PAYMENT_SUCCESS') {
      console.error('[phonepe-callback] Status check failed:', statusData.code);
      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
  } catch (err) {
    console.error('[phonepe-callback] Status check API failed:', err);
    // Continue processing based on callback data — status check is additional verification
  }

  // ── 6. Idempotency check ────────────────────────────────────────────────────
  const pendingOrderDoc = await adminDb
    .collection('orders')
    .doc(merchantTransactionId)
    .get();

  if (!pendingOrderDoc.exists) {
    console.error('[phonepe-callback] Pending order not found:', merchantTransactionId);
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  const pendingData = pendingOrderDoc.data()!;

  // Already confirmed — skip (redirect handler won the race)
  if (pendingData.status === 'confirmed' && pendingData.payment?.status === 'paid') {
    console.log('[phonepe-callback] ⚡ Order already confirmed:', merchantTransactionId);
    return NextResponse.json({ status: 'ok', alreadyProcessed: true }, { status: 200 });
  }

  // ── 7. Amount verification ──────────────────────────────────────────────────
  const expectedAmountPaise = pendingData.payment?.expectedAmountPaise;

  if (paidAmountPaise && expectedAmountPaise && paidAmountPaise !== expectedAmountPaise) {
    console.error('[phonepe-callback] ❌ Amount mismatch! Expected:', expectedAmountPaise, 'Got:', paidAmountPaise);
    await adminDb.collection('orders').doc(merchantTransactionId).update({
      status: 'tampered',
      'payment.status': 'amount_mismatch',
      'payment.paidAmountPaise': paidAmountPaise,
    });
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  }

  // ── 8. Create confirmed order via shared helper ─────────────────────────────
  try {
    const result = await createOrder({
      merchantTransactionId,
      phonePeTransactionId,
      total: pendingData.total || pendingData.payment?.expectedAmount || 0,
      items: pendingData.items || [],
      shippingAddress: pendingData.shippingAddress || {},
      userId: pendingData.userId || '',
      userEmail: pendingData.userEmail || '',
      userName: pendingData.userName || '',
    });

    if (result.alreadyExisted) {
      console.log('[phonepe-callback] ⚠️ Order already existed (redirect won the race)');
    } else {
      console.log('[phonepe-callback] ✅ Order created by callback:', result.orderId);
    }

    return NextResponse.json({ status: 'ok', orderId: result.orderId }, { status: 200 });

  } catch (err) {
    console.error('[phonepe-callback] ❌ Order creation failed:', err);
    // Return 200 to stop PhonePe retries — log for manual investigation
    return NextResponse.json({ status: 'ok', error: 'processing_failed' }, { status: 200 });
  }
}
