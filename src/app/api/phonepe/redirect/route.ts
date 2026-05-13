import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { generateStatusChecksum } from '@/lib/phonepe';
import { createOrder } from '@/lib/orders/createOrder';
import { z } from 'zod';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

/**
 * PhonePe redirects the customer here after payment.
 *
 * Flow:
 * 1. Read merchantTransactionId from query params
 * 2. Call PhonePe status check API to verify payment
 * 3. Update Firestore order status
 * 4. Redirect to success or failure page
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  // PhonePe sends merchantTransactionId in the redirect URL or we read from cookie
  let rawMerchantTransactionId =
    searchParams.get('merchantTransactionId') ||
    searchParams.get('transactionId') ||
    '';

  if (!rawMerchantTransactionId) {
    rawMerchantTransactionId = req.cookies.get("phonepe_txn_id")?.value || '';
  }

  const txIdValidation = z.string()
    .min(1)
    .max(38)
    .regex(/^[a-zA-Z0-9_]+$/, "Invalid merchantTransactionId format")
    .safeParse(rawMerchantTransactionId);

  if (!txIdValidation.success) {
    return NextResponse.redirect(new URL('/payment/failure?reason=missing_txn_id', req.url));
  }

  const merchantTransactionId = txIdValidation.data;

  try {
    const merchantId = process.env.PHONEPE_MERCHANT_ID!;
    const saltKey = process.env.PHONEPE_SALT_KEY!;
    const saltIndex = process.env.PHONEPE_SALT_INDEX!;

    // ── 1. Call PhonePe Status Check API ─────────────────────────────────────
    const statusEndpoint = `/pg/v1/status/${merchantId}/${merchantTransactionId}`;

    const statusChecksum = generateStatusChecksum(
      statusEndpoint,
      saltKey,
      saltIndex
    );

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

    console.log('[phonepe-redirect] Status check response:', statusData.code);

    // ── 2. Check payment status ─────────────────────────────────────────────
    if (statusData.code === 'PAYMENT_SUCCESS' && statusData.success === true) {
      // ── 3. Fetch pending order from Firestore ───────────────────────────────
      const pendingOrderDoc = await adminDb
        .collection('orders')
        .doc(merchantTransactionId)
        .get();

      if (pendingOrderDoc.exists) {
        const pendingData = pendingOrderDoc.data()!;

        // Amount verification: PhonePe returns amount in paise
        const paidAmountPaise = statusData.data?.amount;
        const expectedAmountPaise = pendingData.payment?.expectedAmountPaise;

        if (paidAmountPaise && expectedAmountPaise && paidAmountPaise !== expectedAmountPaise) {
          console.error('[phonepe-redirect] ❌ Amount mismatch! Expected:', expectedAmountPaise, 'Got:', paidAmountPaise);
          await adminDb.collection('orders').doc(merchantTransactionId).update({
            status: 'tampered',
            'payment.status': 'amount_mismatch',
            'payment.paidAmountPaise': paidAmountPaise,
          });
          return NextResponse.redirect(new URL('/payment/failure?reason=amount_mismatch', req.url));
        }

        // Only process if not already paid (idempotency)
        if (pendingData.status !== 'confirmed' && pendingData.payment?.status !== 'paid') {
          // Create final confirmed order via shared helper
          const result = await createOrder({
            merchantTransactionId,
            phonePeTransactionId: statusData.data?.transactionId || '',
            total: pendingData.total || pendingData.payment?.expectedAmount || 0,
            items: pendingData.items || [],
            shippingAddress: pendingData.shippingAddress || {},
            userId: pendingData.userId || '',
            userEmail: pendingData.userEmail || '',
            userName: pendingData.userName || '',
          });

          console.log('[phonepe-redirect] ✅ Order confirmed:', result.orderId);

          return NextResponse.redirect(
            new URL(`/order-success?orderId=${result.orderId}`, req.url)
          );
        } else {
          // Already processed (callback won the race)
          console.log('[phonepe-redirect] ⚡ Order already confirmed for:', merchantTransactionId);
          
          // Find the confirmed order ID
          const confirmedSnap = await adminDb
            .collection('orders')
            .where('payment.merchantTransactionId', '==', merchantTransactionId)
            .where('payment.status', '==', 'paid')
            .limit(1)
            .get();

          const orderId = confirmedSnap.empty
            ? merchantTransactionId
            : confirmedSnap.docs[0].id;

          return NextResponse.redirect(
            new URL(`/order-success?orderId=${orderId}`, req.url)
          );
        }
      } else {
        console.error('[phonepe-redirect] Pending order not found:', merchantTransactionId);
        // Payment succeeded but order doc missing — still redirect to success
        // The callback handler should pick it up
        return NextResponse.redirect(
          new URL(`/order-success?orderId=${merchantTransactionId}`, req.url)
        );
      }
    } else {
      // Payment failed or was cancelled
      console.log('[phonepe-redirect] Payment not successful. Code:', statusData.code);

      // Update pending order status
      try {
        await adminDb.collection('orders').doc(merchantTransactionId).update({
          status: 'payment_failed',
          'payment.status': 'failed',
          'payment.failureCode': statusData.code || 'UNKNOWN',
          'payment.failureMessage': statusData.message || '',
        });
      } catch {
        // Pending order might not exist
      }

      return NextResponse.redirect(
        new URL(`/payment/failure?txnid=${merchantTransactionId}&reason=${statusData.code || 'PAYMENT_FAILED'}`, req.url)
      );
    }

  } catch (err) {
    console.error('[phonepe-redirect] Error during status check:', err);
    return NextResponse.redirect(
      new URL(`/payment/failure?txnid=${merchantTransactionId}&reason=server_error`, req.url)
    );
  }
}

/**
 * PhonePe may also POST to the redirect URL in some scenarios.
 */
export async function POST(req: NextRequest) {
  // Extract merchantTransactionId from form data or body
  let merchantTransactionId = '';

  try {
    const body = await req.json();
    merchantTransactionId = body.merchantTransactionId || body.transactionId || '';
  } catch {
    try {
      const formData = await req.formData();
      merchantTransactionId =
        (formData.get('merchantTransactionId') as string) ||
        (formData.get('transactionId') as string) ||
        '';
    } catch {
      // ignore
    }
  }

  // Re-use the GET handler logic by constructing a URL with the txnId
  const redirectUrl = new URL(req.url);
  redirectUrl.searchParams.set('merchantTransactionId', merchantTransactionId);

  return NextResponse.redirect(redirectUrl);
}
