import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import crypto from 'crypto';
import type { Order } from '@/types/index';

export const runtime = 'nodejs';

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

  console.log('[verify-payment] Signature verified for:', razorpayPaymentId);

  // Step 4 — Idempotency Check (Anti-Tampering & Duplicate Prevention)
  console.log('[verify-payment] Checking idempotency for:', razorpayOrderId);
  
  const existing = await adminDb.collection('orders')
    .where('payment.razorpayOrderId', '==', razorpayOrderId)
    .where('payment.status', '==', 'paid')
    .get();

  if (!existing.empty) {
    console.log('[verify-payment] ⚠️ Idempotency Triggered: Order already processed:', razorpayOrderId);
    return NextResponse.json({
      success: true,
      orderId: existing.docs[0].id,
      duplicate: true,
    });
  }

  console.log('[verify-payment] Proceeding with order creation for:', razorpayOrderId);


  // Step 5 — Verify items from Firestore (server-side price verification)
  const verifiedItems: any[] = items || [];

  // Step 6 — Create order in Firestore with correct nested schema
  const orderData: Omit<Order, 'id'> = {
    userId: decodedToken.uid,
    userEmail: decodedToken.email || '',
    userName: shippingAddress?.name || '',
    total: total,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    deliveredAt: null,

    payment: {
      method: 'razorpay',
      razorpayOrderId: razorpayOrderId,
      razorpayPaymentId: razorpayPaymentId,
      status: 'paid',
    },

    shippingAddress: {
      name: shippingAddress?.name || '',
      phone: shippingAddress?.phone || '',
      line1: shippingAddress?.line1 || '',
      city: shippingAddress?.city || '',
      state: shippingAddress?.state || '',
      pincode: shippingAddress?.pincode || '',
    },

    items: verifiedItems,

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
  };

  let docRef: any;
  try {
    docRef = await adminDb.collection('orders').add(orderData);
    console.log('[verify-payment] Order created:', docRef.id);
  } catch (err) {
    console.error('[verify-payment] Firestore write failed:', err);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }

  // Step 7 — All background jobs — non blocking
  // 1. Shiprocket shipment creation
  createShiprocketShipmentBackground(docRef.id, orderData)
    .catch(err => console.error('[shiprocket] Background failed:', err));

  // 2. Google Sheets sync
  syncToGoogleSheets(docRef.id, orderData)
    .catch(err => console.error('[sheetdb] Sync failed:', err));

  // 3. Confirmation email
  sendConfirmationEmail(orderData, docRef.id)
    .catch(err => console.error('[email] Send failed:', err));

  // Return success immediately to client
  return NextResponse.json({
    success: true,
    orderId: docRef.id,
  });
}

// ─── BACKGROUND: Shiprocket Shipment ───────────────────────────────────────

async function createShiprocketShipmentBackground(
  orderId: string,
  orderData: any
): Promise<void> {
  // Small delay to ensure Firestore write is fully committed
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    console.log('[shiprocket] Starting for order:', orderId);
    const { shiprocket } = await import('@/lib/shiprocket');

    // Step 1 — Create shipment
    const shipment = await shiprocket.createShipment({
      orderId,
      orderDate: new Date().toISOString().split('T')[0],
      customerName: orderData.shippingAddress?.name || '',
      customerEmail: orderData.userEmail,
      customerPhone: orderData.shippingAddress?.phone || '',
      shippingAddress: orderData.shippingAddress,
      items: orderData.items.map((item: any) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      totalAmount: orderData.total,
    });

    // Step 2 — Generate AWB if not returned with shipment
    let awb = shipment.awb;
    let courierName = shipment.courierName;

    if (shipment.shipmentId && !awb) {
      const awbData = await shiprocket.generateAWB(shipment.shipmentId);
      awb = awbData.awb;
      courierName = awbData.courierName;
    }

    // Step 3 — Generate label
    let labelUrl = '';
    if (shipment.shipmentId) {
      try {
        labelUrl = await shiprocket.generateLabel(shipment.shipmentId);
      } catch {
        console.error('[shiprocket] Label generation failed — non critical');
      }
    }

    // Step 4 — Update Firestore order with nested Shiprocket data
    const { adminDb: db } = await import('@/lib/firebase-admin');

    await db.collection('orders').doc(orderId).update({
      'shiprocket.orderId': shipment.shiprocketOrderId,
      'shiprocket.shipmentId': shipment.shipmentId,
      'shiprocket.awb': awb || null,
      'shiprocket.courierName': courierName || null,
      'shiprocket.labelUrl': labelUrl || null,
      'shiprocket.status': 'shipment_created',
      'shiprocket.statusLabel': 'Shipment Created',
      'shiprocket.lastUpdated': new Date().toISOString(),
      'shiprocket.error': null,
      'shiprocket.attempts': 1,
    });

    // Step 5 — Update Google Sheets with Shiprocket details
    const { sheetdb } = await import('@/lib/sheetdb');
    await sheetdb.updateOrderStatus(orderId, {
      shiprocketId: shipment.shiprocketOrderId,
      awb: awb || '',
      courier: courierName || '',
      shippingStatus: 'Shipment Created',
      labelUrl: labelUrl || '',
    }).catch(() => {});

    console.log('[shiprocket] ✅ Complete:', orderId, '| AWB:', awb);

  } catch (err) {
    console.error('[shiprocket] ❌ Failed for order:', orderId, err);

    const { adminDb: db } = await import('@/lib/firebase-admin');

    await db.collection('orders').doc(orderId).update({
      'shiprocket.status': 'shiprocket_failed',
      'shiprocket.error': err instanceof Error ? err.message : 'Unknown error',
      'shiprocket.lastUpdated': new Date().toISOString(),
      'shiprocket.attempts': 1,
    }).catch(() => {});
  }
}

// ─── BACKGROUND: Google Sheets Sync ────────────────────────────────────────

async function syncToGoogleSheets(
  orderId: string,
  orderData: any
): Promise<void> {
  console.log('[sheetdb] Syncing order to Google Sheets:', orderId);
  const { sheetdb } = await import('@/lib/sheetdb');

  await sheetdb.addOrder({
    orderId,
    createdAt: orderData.createdAt,
    userName: orderData.userName,
    userEmail: orderData.userEmail,
    phone: orderData.shippingAddress?.phone || '',
    total: orderData.total,
    razorpayPaymentId: orderData.payment?.razorpayPaymentId || '',
    items: orderData.items || [],
    shippingAddress: {
      line1: orderData.shippingAddress?.line1 || '',
      city: orderData.shippingAddress?.city || '',
      state: orderData.shippingAddress?.state || '',
      pincode: orderData.shippingAddress?.pincode || '',
    },
  });
}

// ─── BACKGROUND: Confirmation Email ────────────────────────────────────────

async function sendConfirmationEmail(
  orderData: any,
  orderId: string
): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const escapeHtml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const itemsHtml = (orderData.items || [])
    .map((item: any) => `
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

  await resend.emails.send({
    from: `Shivam Hookah <${process.env.RESEND_FROM_EMAIL || 'orders@shivamhookah.in'}>`,
    to: orderData.userEmail,
    subject: `Order Confirmed — #${orderId}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;
                  background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;">
        <h1 style="color:#d4af37;margin-bottom:4px;">Order Confirmed 🎉</h1>
        <p style="color:#999;margin-top:0;">Thank you for shopping with Shivam Hookah</p>
        
        <div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:20px 0;">
          <p style="margin:4px 0;color:#888;font-size:13px;">
            <strong style="color:#fff;">Order ID:</strong> #${escapeHtml(orderId)}
          </p>
          <p style="margin:4px 0;color:#888;font-size:13px;">
            <strong style="color:#fff;">Payment ID:</strong> 
            ${escapeHtml(orderData.payment?.razorpayPaymentId || '')}
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
          Total: ₹${orderData.total.toFixed(2)}
        </p>

        <div style="background:#1a1a1a;padding:16px;border-radius:8px;margin-top:20px;">
          <h3 style="color:#d4af37;margin:0 0 10px;font-size:14px;">
            📦 Shipping To
          </h3>
          <p style="color:#ccc;margin:0;line-height:1.8;font-size:13px;">
            ${escapeHtml(orderData.shippingAddress?.name || '')}<br/>
            ${escapeHtml(orderData.shippingAddress?.line1 || '')}<br/>
            ${escapeHtml(orderData.shippingAddress?.city || '')}, 
            ${escapeHtml(orderData.shippingAddress?.state || '')} — 
            ${escapeHtml(orderData.shippingAddress?.pincode || '')}<br/>
            📞 ${escapeHtml(orderData.shippingAddress?.phone || '')}
          </p>
        </div>

        <p style="color:#444;font-size:11px;text-align:center;margin-top:24px;">
          © 2026 Shivam Hookah · shivamhookah.in
        </p>
      </div>
    `,
  });

  console.log('[email] ✅ Sent to:', orderData.userEmail);
}
