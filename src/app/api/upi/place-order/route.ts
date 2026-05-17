import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

const UpiOrderSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string().min(1).max(100),
      quantity: z.number().int().min(1).max(100),
      color: z.string().optional(),
    })
  ).min(1).max(20),
  shippingAddress: z.object({
    name: z.string().min(2).max(100),
    phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian phone number'),
    line1: z.string().min(10).max(300),
    city: z.string().min(2).max(100),
    state: z.string().min(2).max(100),
    pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode'),
  }),
});

export async function POST(req: NextRequest) {
  // ── 1. Verify Firebase auth token ─────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.split('Bearer ')[1];

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let decoded: any;
  try {
    decoded = await adminAuth.verifyIdToken(token);
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const userId = decoded.uid;
  const userEmail = decoded.email || '';

  // ── 2. Parse and validate request body ──────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validation = UpiOrderSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request details', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { items, shippingAddress } = validation.data;

  // ── 3. Fetch real prices from Firestore (NEVER trust client prices) ─────────
  const verifiedItems: any[] = [];
  let total = 0;

  try {
    for (const item of items) {
      const productDoc = await adminDb
        .collection('products')
        .doc(item.productId)
        .get();

      if (!productDoc.exists) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 404 }
        );
      }

      const product = productDoc.data()!;

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for: ${product.name}` },
          { status: 400 }
        );
      }

      const itemTotal = product.price * item.quantity;
      total += itemTotal;

      verifiedItems.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        imageUrl: product.imageUrl || '',
        color: item.color || '',
        total: itemTotal,
      });
    }
  } catch (err) {
    console.error('[upi-place-order] Product verification failed:', err);
    return NextResponse.json(
      { error: 'Failed to verify products' },
      { status: 500 }
    );
  }

  console.log(`[upi-place-order] Verified ${verifiedItems.length} items. Total: ₹${total}`);

  // ── 4. Generate unique order ID ─────────────────────────────────────────────
  const orderId = `UPI_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  // ── 5. Create order in Firestore ────────────────────────────────────────────
  try {
    await adminDb.collection('orders').doc(orderId).set({
      orderId,
      userId,
      userEmail,
      userName: shippingAddress.name,
      total,
      status: 'pending_verification',
      payment: {
        gateway: 'upi_manual',
        expectedAmount: total,
        whatsappSent: false,
        confirmedAt: null,
        confirmedBy: null,
      },
      items: verifiedItems,
      shippingAddress: {
        name: shippingAddress.name,
        phone: shippingAddress.phone,
        line1: shippingAddress.line1,
        city: shippingAddress.city,
        state: shippingAddress.state,
        pincode: shippingAddress.pincode,
      },
      shiprocket: {
        orderId: null,
        shipmentId: null,
        awb: null,
        courierName: null,
        courierCode: null,
        labelUrl: null,
        manifestUrl: null,
        status: null,
        statusLabel: null,
        statusCode: null,
        etd: null,
        lastUpdated: null,
        error: null,
        attempts: 0,
      },
      backgroundTasks: {
        shiprocket: 'pending',
        email: 'pending',
        googleSheets: 'pending',
      },
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('[upi-place-order] ✅ Order created:', orderId);
  } catch (err) {
    console.error('[upi-place-order] Failed to create order:', err);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }

  // ── 6. Send "Order Placed" email via Resend (background task) ───────────────
  waitUntil(
    sendOrderPlacedEmail(orderId, shippingAddress, verifiedItems, total, userEmail)
      .catch(err => console.error('[upi-email] Failed:', err))
  );

  // ── 7. Return success ──────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    orderId,
    message: 'Order placed successfully',
  });
}

// ─── BACKGROUND: "Order Placed" Email ──────────────────────────────────────

async function sendOrderPlacedEmail(
  orderId: string,
  shippingAddress: {
    name: string;
    phone: string;
    line1: string;
    city: string;
    state: string;
    pincode: string;
  },
  items: any[],
  total: number,
  userEmail: string,
): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const escapeHtml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const itemsHtml = items
    .map((item) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #2a2a2a;">
          ${escapeHtml(item.name)}
          ${item.color
        ? `<span style="color:#888;font-size:11px;"> (${escapeHtml(item.color)})</span>`
        : ''}
        </td>
        <td style="padding:8px;border-bottom:1px solid #2a2a2a;text-align:center;">
          ${item.quantity}
        </td>
        <td style="padding:8px;border-bottom:1px solid #2a2a2a;text-align:right;">
          ₹${(item.price * item.quantity).toFixed(2)}
        </td>
      </tr>
    `)
    .join('');

  try {
    await resend.emails.send({
      from: `Shivam Lifestyle <${process.env.RESEND_FROM_EMAIL || 'orders@shivamhookah.in'}>`,
      to: userEmail,
      subject: `Order Received — Shivam Lifestyle Accessories`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;
                    background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;">
          <h1 style="color:#d4af37;margin-bottom:4px;">🛍️ Thank you for your order!</h1>
          <p style="color:#999;margin-top:0;">Hi ${escapeHtml(shippingAddress.name)},</p>
          
          <p style="color:#ccc;line-height:1.6;">
            We have received your order and it is pending payment verification.
            We will confirm it within <strong style="color:#fff;">2 hours</strong> 
            after verifying your UPI payment.
          </p>
          
          <!-- Order ID Box -->
          <div style="
            background-color: #f0fdf4;
            border: 2px solid #86efac;
            border-radius: 12px;
            padding: 16px 20px;
            margin: 20px 0;
            text-align: center;
          ">
            <p style="
              font-size: 11px;
              color: #6b7280;
              text-transform: uppercase;
              letter-spacing: 0.1em;
              margin: 0 0 8px 0;
              font-family: sans-serif;
            ">
              Your Order ID
            </p>
            <p style="
              font-size: 22px;
              font-weight: 700;
              color: #166534;
              font-family: monospace;
              margin: 0 0 8px 0;
              word-break: break-all;
            ">
              ${escapeHtml(orderId)}
            </p>
            <p style="
              font-size: 12px;
              color: #6b7280;
              margin: 0;
              font-family: sans-serif;
            ">
              Save this Order ID for tracking 
              your order status
            </p>
          </div>

          <!-- Important reminder box -->
          <div style="
            background-color: #fefce8;
            border: 1px solid #fde047;
            border-radius: 10px;
            padding: 14px 18px;
            margin: 16px 0;
          ">
            <p style="
              font-size: 13px;
              color: #854d0e;
              margin: 0;
              font-family: sans-serif;
              line-height: 1.6;
            ">
              ⚠️ <strong>Important:</strong> 
              Please send your UPI payment screenshot 
              on WhatsApp along with your Order ID 
              <strong>${escapeHtml(orderId)}</strong> 
              to complete your order confirmation.
            </p>
          </div>

          <div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:20px 0;">
            <p style="margin:4px 0;color:#888;font-size:13px;">
              <strong style="color:#fff;">Payment Method:</strong> UPI Manual
            </p>
            <p style="margin:4px 0;color:#888;font-size:13px;">
              <strong style="color:#fff;">Status:</strong> 
              <span style="color:#f59e0b;">Awaiting Verification</span>
            </p>
          </div>

          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:#1a1a1a;">
                <th style="padding:8px;text-align:left;color:#d4af37;font-size:13px;">
                  Product
                </th>
                <th style="padding:8px;text-align:center;color:#d4af37;font-size:13px;">
                  Qty
                </th>
                <th style="padding:8px;text-align:right;color:#d4af37;font-size:13px;">
                  Price
                </th>
              </tr>
            </thead>
            <tbody style="color:#ccc;">${itemsHtml}</tbody>
          </table>

          <p style="font-size:20px;font-weight:bold;text-align:right;
                    color:#d4af37;margin-top:16px;">
            Total Paid: ₹${total.toFixed(2)}
          </p>

          <div style="background:#1a1a1a;padding:16px;border-radius:8px;margin-top:20px;">
            <h3 style="color:#d4af37;margin:0 0 10px;font-size:14px;">
              📦 Shipping To
            </h3>
            <p style="color:#ccc;margin:0;line-height:1.8;font-size:13px;">
              ${escapeHtml(shippingAddress.name)}<br/>
              ${escapeHtml(shippingAddress.line1)}<br/>
              ${escapeHtml(shippingAddress.city)}, 
              ${escapeHtml(shippingAddress.state)} — 
              ${escapeHtml(shippingAddress.pincode)}<br/>
              📞 ${escapeHtml(shippingAddress.phone)}
            </p>
          </div>

          <div style="background:#332b00;padding:16px;border-radius:8px;margin-top:20px;
                      border:1px solid #665500;">
            <p style="color:#fbbf24;margin:0;font-size:13px;line-height:1.6;">
              ⚠️ <strong>Important — Last step!</strong><br/>
              Please send your payment screenshot on WhatsApp to: 
              <strong>+918922942213</strong><br/>
              We will verify and confirm your order within 2 hours.
            </p>
          </div>

          <p style="color:#999;font-size:12px;margin-top:20px;line-height:1.6;">
            Questions? Reply to this email or WhatsApp us at +918922942213.
          </p>

          <p style="color:#444;font-size:11px;text-align:center;margin-top:24px;">
            © 2026 Shivam Lifestyle Accessories · shivamhookah.in
          </p>
        </div>
      `,
    });

    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.email': 'success',
    });
    console.log('[upi-email] ✅ Order placed email sent to:', userEmail);

  } catch (err) {
    console.error('[upi-email] ❌ Failed:', err);
    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.email': 'failed',
    }).catch(() => { });
    throw err;
  }
}
