import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { addDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { adminDb } from '@/lib/firebase-admin';
import { Resend } from 'resend';
import { logOrderToSheetDB } from '@/lib/sheetdb';

// CRITICAL: Must be nodejs runtime — edge runtime breaks raw body reading
export const runtime = 'nodejs';

// CRITICAL: Tell Next.js NOT to parse the body automatically
export const dynamic = 'force-dynamic';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia' as any,
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  // STEP 1: Read raw body FIRST — before anything else
  // This is the fix — req.text() not req.json()
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch (err) {
    console.error('[webhook] Failed to read raw body:', err);
    return NextResponse.json(
      { error: 'Could not read request body' },
      { status: 400 }
    );
  }

  // STEP 2: Get stripe signature header
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    console.error('[webhook] Missing stripe-signature header');
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  // STEP 3: Verify webhook signature using raw body
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,           // raw string — NOT parsed JSON
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('[webhook] Signature verification failed:', err);
    return NextResponse.json(
      { error: 'Invalid webhook signature' },
      { status: 400 }
    );
  }

  console.log('[webhook] Event verified:', event.type, event.id);

  // STEP 4: Handle the event
  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      console.log('[webhook] Payment succeeded:', intent.id, 'Amount:', intent.amount);

      await handlePaymentSuccess(intent);
    } else {
      console.log('[webhook] Unhandled event type:', event.type);
    }
  } catch (err) {
    console.error('[webhook] Handler error:', err);
    // Still return 200 so Stripe does not keep retrying
    // Log the error for manual investigation
    return NextResponse.json(
      { received: true, error: 'Handler failed — check logs' },
      { status: 200 }
    );
  }

  // STEP 5: Always return 200 to Stripe
  return NextResponse.json({ received: true }, { status: 200 });
}

async function handlePaymentSuccess(intent: Stripe.PaymentIntent) {
  console.log('[webhook] Processing order for intent:', intent.id);

  // Check for duplicate order
  const existing = await adminDb
    .collection('orders')
    .where('stripePaymentIntentId', '==', intent.id)
    .get();

  if (!existing.empty) {
    console.log('[webhook] Order already exists for intent:', intent.id);
    return;
  }

  // Extract metadata attached to the PaymentIntent
  const metadata = intent.metadata;

  let parsedAddress: any = {};
  if (metadata.shippingAddress) {
    try {
      parsedAddress = JSON.parse(metadata.shippingAddress);
    } catch (e) {
      console.error("[webhook] Failed to parse shippingAddress metadata", e);
    }
  }

  const orderData = {
    userId: metadata.userId || '',
    userEmail: metadata.userEmail || '',
    userName: metadata.userName || '',
    total: intent.amount / 100, // convert paise to rupees
    stripePaymentIntentId: intent.id,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    shippingAddress: {
      name: parsedAddress.name || metadata.shippingName || '',
      phone: parsedAddress.phone || metadata.shippingPhone || '',
      line1: parsedAddress.line1 || metadata.shippingLine1 || '',
      city: parsedAddress.city || metadata.shippingCity || '',
      state: parsedAddress.state || metadata.shippingState || '',
      pincode: parsedAddress.pincode || metadata.shippingPincode || '',
    },
    items: JSON.parse(metadata.items || '[]'),
  };

  // Write order to Firestore
  const docRef = await adminDb.collection('orders').add(orderData);
  console.log('[webhook] Order created in Firestore:', docRef.id);

  // Log to SheetDB (Non-blocking)
  logOrderToSheetDB(orderData);

  // Send confirmation email
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Haze & Co. <onboarding@resend.dev>',
      to: orderData.userEmail,
      subject: `Order Confirmed — #${docRef.id}`,
      html: buildEmailTemplate(orderData, docRef.id),
    });
    console.log('[webhook] Confirmation email sent to:', orderData.userEmail);
  } catch (emailErr) {
    console.error('[webhook] Email failed (non-critical):', emailErr);
  }
}

function buildEmailTemplate(order: any, orderId: string): string {
  const itemsHtml = order.items
    .map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">
          ${escapeHtml(item.name)}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">
          ₹${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `)
    .join('');

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #1a1a1a;">Order Confirmed 🎉</h1>
      <p>Hi ${escapeHtml(order.userName)}, your order has been placed successfully.</p>
      <p><strong>Order ID:</strong> ${escapeHtml(orderId)}</p>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 8px; text-align: left;">Product</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Price</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="font-size: 18px; font-weight: bold; text-align: right;">
        Total: ₹${order.total.toFixed(2)}
      </p>
      <h3>Shipping To:</h3>
      <p>
        ${escapeHtml(order.shippingAddress.name)}<br/>
        ${escapeHtml(order.shippingAddress.line1)}<br/>
        ${escapeHtml(order.shippingAddress.city)}, 
        ${escapeHtml(order.shippingAddress.state)} - 
        ${escapeHtml(order.shippingAddress.pincode)}<br/>
        Phone: ${escapeHtml(order.shippingAddress.phone)}
      </p>
      <p style="color: #666; font-size: 12px;">
        Thank you for shopping with Haze & Co.
      </p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
