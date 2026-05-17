import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { waitUntil } from '@vercel/functions';
import { z } from 'zod';

export const runtime = 'nodejs';
export const preferredRegion = 'bom1';
export const maxDuration = 30;

const ConfirmUpiSchema = z.object({
  orderId: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  // ── 1. Verify Firebase auth + admin email ──────────────────────────────────
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

  const ADMIN_EMAILS = [
    process.env.ADMIN_EMAIL_1,
    process.env.ADMIN_EMAIL_2,
  ].filter(Boolean);

  if (!decoded.email || !ADMIN_EMAILS.includes(decoded.email)) {
    console.error('[confirm-upi] Unauthorized access attempt by:', decoded.email);
    return NextResponse.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  // ── 2. Validate request body ───────────────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validation = ConfirmUpiSchema.safeParse(body);

  if (!validation.success) {
    return NextResponse.json(
      { error: 'Invalid request', details: validation.error.flatten() },
      { status: 400 }
    );
  }

  const { orderId } = validation.data;

  // ── 3. Fetch order from Firestore ──────────────────────────────────────────
  const orderDoc = await adminDb.collection('orders').doc(orderId).get();

  if (!orderDoc.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const order = orderDoc.data()!;

  // Check it's a UPI manual order
  if (order.payment?.gateway !== 'upi_manual') {
    return NextResponse.json({ error: 'Not a UPI manual order' }, { status: 400 });
  }

  // Check not already confirmed
  if (order.status === 'confirmed') {
    return NextResponse.json({ error: 'Order already confirmed' }, { status: 400 });
  }

  // ── 4. Update Firestore order status ───────────────────────────────────────
  try {
    await adminDb.collection('orders').doc(orderId).update({
      status: 'confirmed',
      'payment.confirmedAt': FieldValue.serverTimestamp(),
      'payment.confirmedBy': decoded.email,
      updatedAt: FieldValue.serverTimestamp(),
    });

    console.log('[confirm-upi] ✅ Order confirmed:', orderId, 'by:', decoded.email);
  } catch (err) {
    console.error('[confirm-upi] Failed to update order:', err);
    return NextResponse.json({ error: 'Failed to confirm order' }, { status: 500 });
  }

  // ── 5. Trigger ALL background tasks with waitUntil ─────────────────────────

  // TASK A — Shiprocket Shipment
  waitUntil(
    createShiprocketShipmentBackground(orderId, order)
      .catch(err => console.error('[confirm-upi][shiprocket] Failed:', err))
  );

  // TASK B — Google Sheets Sync
  waitUntil(
    syncToGoogleSheets(orderId, order)
      .catch(err => console.error('[confirm-upi][sheetdb] Failed:', err))
  );

  // TASK C — "Order Confirmed" Email
  waitUntil(
    sendOrderConfirmedEmail(orderId, order)
      .catch(err => console.error('[confirm-upi][email] Failed:', err))
  );

  // ── 6. Return success ─────────────────────────────────────────────────────
  return NextResponse.json({
    success: true,
    message: 'Order confirmed successfully',
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
    console.log('[confirm-upi][shiprocket] Starting for order:', orderId);
    const { shiprocket } = await import('@/lib/shiprocket');

    // Step 1 — Create shipment
    const shipment = await shiprocket.createShipment({
      orderId,
      orderDate: new Date().toISOString().split('T')[0],
      customerName: orderData.shippingAddress?.name || orderData.userName || '',
      customerEmail: orderData.userEmail || '',
      customerPhone: orderData.shippingAddress?.phone || '',
      shippingAddress: orderData.shippingAddress,
      items: (orderData.items || []).map((item: any) => ({
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
        console.error('[confirm-upi][shiprocket] Label generation failed — non critical');
      }
    }

    // Step 4 — Update Firestore
    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.shiprocket': 'success',
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
    }).catch(() => { });

    console.log('[confirm-upi][shiprocket] ✅ Complete:', orderId, '| AWB:', awb);

  } catch (err) {
    console.error('[confirm-upi][shiprocket] ❌ Failed for order:', orderId, err);

    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.shiprocket': 'failed',
      'shiprocket.status': 'shiprocket_failed',
      'shiprocket.error': err instanceof Error ? err.message : 'Unknown error',
      'shiprocket.lastUpdated': new Date().toISOString(),
      'shiprocket.attempts': (orderData.shiprocket?.attempts || 0) + 1,
    }).catch(() => { });
  }
}

// ─── BACKGROUND: Google Sheets Sync ────────────────────────────────────────

async function syncToGoogleSheets(
  orderId: string,
  orderData: any
): Promise<void> {
  console.log('[confirm-upi][sheetdb] Syncing order to Google Sheets:', orderId);
  const { sheetdb } = await import('@/lib/sheetdb');

  try {
    await sheetdb.addOrder({
      orderId,
      createdAt: orderData.createdAt
        ? new Date(orderData.createdAt._seconds * 1000).toISOString()
        : new Date().toISOString(),
      userName: orderData.shippingAddress?.name || orderData.userName || '',
      userEmail: orderData.userEmail || '',
      phone: orderData.shippingAddress?.phone || '',
      total: orderData.total || 0,
      paymentId: `UPI_MANUAL_${orderId}`,
      items: orderData.items || [],
      shippingAddress: {
        line1: orderData.shippingAddress?.line1 || '',
        city: orderData.shippingAddress?.city || '',
        state: orderData.shippingAddress?.state || '',
        pincode: orderData.shippingAddress?.pincode || '',
      },
    });

    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.googleSheets': 'success',
    });

    console.log('[confirm-upi][sheetdb] ✅ Order synced:', orderId);
  } catch (err) {
    console.error('[confirm-upi][sheetdb] ❌ Failed:', err);
    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.googleSheets': 'failed',
    }).catch(() => { });
    throw err;
  }
}

// ─── BACKGROUND: "Order Confirmed" Email ───────────────────────────────────

async function sendOrderConfirmedEmail(
  orderId: string,
  orderData: any
): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  const escapeHtml = (str: string) =>
    String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const customerEmail = orderData.userEmail || '';
  const customerName = orderData.shippingAddress?.name || orderData.userName || 'Customer';

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

  try {
    await resend.emails.send({
      from: `Shivam Lifestyle <${process.env.RESEND_FROM_EMAIL || 'orders@shivamhookah.in'}>`,
      to: customerEmail,
      subject: `✅ Order Confirmed — Shivam Lifestyle Accessories`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;
                    background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;">
          <h1 style="color:#22c55e;margin-bottom:4px;">✅ Your order is confirmed!</h1>
          <p style="color:#999;margin-top:0;">Hi ${escapeHtml(customerName)},</p>
          
          <p style="color:#ccc;line-height:1.6;">
            Great news! We have verified your UPI payment and your order is now 
            confirmed. We are preparing it for shipment right away!
          </p>
          
          <div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:20px 0;">
            <p style="margin:4px 0;color:#888;font-size:13px;">
              <strong style="color:#fff;">Order ID:</strong> #${escapeHtml(orderId)}
            </p>
            <p style="margin:4px 0;color:#888;font-size:13px;">
              <strong style="color:#fff;">Status:</strong> 
              <span style="color:#22c55e;">Confirmed ✅</span>
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
            Total: ₹${(orderData.total || 0).toFixed(2)}
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

          <div style="background:#0a2e1a;padding:16px;border-radius:8px;margin-top:20px;
                      border:1px solid #166534;">
            <h3 style="color:#22c55e;margin:0 0 8px;font-size:14px;">
              What happens next
            </h3>
            <p style="color:#86efac;margin:0;font-size:13px;line-height:1.8;">
              📦 Your order is being packed<br/>
              🚚 Shipping within 24-48 hours<br/>
              📱 Tracking details coming soon
            </p>
          </div>

          <p style="color:#999;font-size:12px;margin-top:20px;line-height:1.6;">
            Questions? Reply to this email or WhatsApp us at +918922942213.
          </p>

          <p style="color:#999;font-size:13px;margin-top:16px;">
            Thank you for shopping with us!
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
    console.log('[confirm-upi][email] ✅ Confirmation email sent to:', customerEmail);

  } catch (err) {
    console.error('[confirm-upi][email] ❌ Failed:', err);
    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.email': 'failed',
    }).catch(() => { });
    throw err;
  }
}
