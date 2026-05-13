import { adminDb } from '@/lib/firebase-admin';
import { waitUntil } from '@vercel/functions';
import type { Order, OrderItem, ShippingAddress } from '@/types/index';

// ─── Public Types ──────────────────────────────────────────────────────────

export interface CreateOrderParams {
  merchantTransactionId: string;
  phonePeTransactionId: string;
  /** Total in INR (rupees, NOT paise) */
  total: number;
  items: OrderItem[];
  shippingAddress: ShippingAddress;
  userId: string;
  userEmail: string;
  userName: string;
}

export interface CreateOrderResult {
  orderId: string;
  alreadyExisted: boolean;
}

// ─── Core: Transactional Order Creation ────────────────────────────────────

/**
 * Atomically creates an order in Firestore using a transaction.
 *
 * If an order with the same merchantTransactionId + status=paid already exists,
 * it returns early with `alreadyExisted: true`.
 *
 * Both the redirect handler and the PhonePe callback call this
 * function. The transaction guarantees that only ONE of them wins the
 * race — no duplicate orders, ever.
 */
export async function createOrder(
  params: CreateOrderParams
): Promise<CreateOrderResult> {
  const {
    merchantTransactionId,
    phonePeTransactionId,
    total,
    items,
    shippingAddress,
    userId,
    userEmail,
    userName,
  } = params;

  // ── 1. Pre-flight idempotency query (cheap, avoids transaction overhead
  //       on retries that arrive long after the order was created) ──────────
  const quickCheck = await adminDb
    .collection('orders')
    .where('payment.merchantTransactionId', '==', merchantTransactionId)
    .where('payment.status', '==', 'paid')
    .limit(1)
    .get();

  if (!quickCheck.empty) {
    console.log('[createOrder] ⚡ Fast-path: order already exists for', merchantTransactionId);
    return { orderId: quickCheck.docs[0].id, alreadyExisted: true };
  }

  // ── 2. Transactional create — race-condition safe ───────────────────────
  const newDocRef = adminDb.collection('orders').doc(); // pre-generate ID

  const orderData: Omit<Order, 'id'> = {
    userId,
    userEmail,
    userName,
    total,
    status: 'confirmed',
    createdAt: new Date().toISOString(),
    deliveredAt: null,

    payment: {
      method: 'phonepe',
      merchantTransactionId,
      phonePeTransactionId,
      status: 'paid',
    },

    shippingAddress: {
      name: shippingAddress.name || '',
      phone: shippingAddress.phone || '',
      line1: shippingAddress.line1 || '',
      city: shippingAddress.city || '',
      state: shippingAddress.state || '',
      pincode: shippingAddress.pincode || '',
    },

    items,

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
      shiprocket: "pending",
      email: "pending",
      googleSheets: "pending",
    },
  };

  let alreadyExisted = false;

  await adminDb.runTransaction(async (transaction) => {
    // Re-check inside transaction (authoritative)
    const existingSnap = await transaction.get(
      adminDb
        .collection('orders')
        .where('payment.merchantTransactionId', '==', merchantTransactionId)
        .where('payment.status', '==', 'paid')
        .limit(1)
    );

    if (!existingSnap.empty) {
      alreadyExisted = true;
      return; // another route already created it — skip
    }

    transaction.set(newDocRef, orderData);
  });

  if (alreadyExisted) {
    // Fetch the existing doc ID for the caller
    const existing = await adminDb
      .collection('orders')
      .where('payment.merchantTransactionId', '==', merchantTransactionId)
      .where('payment.status', '==', 'paid')
      .limit(1)
      .get();

    const existingId = existing.docs[0]?.id || newDocRef.id;
    console.log('[createOrder] 🔁 Transaction: order already existed:', existingId);
    return { orderId: existingId, alreadyExisted: true };
  }

  const orderId = newDocRef.id;
  console.log('[createOrder] ✅ Order created:', orderId);

  // ── 3. Clean up the pending order doc ───────────────────────────────────
  // The pending order was stored using merchantTransactionId as doc ID
  // Now that we have the real order, mark the pending one
  waitUntil(
    adminDb.collection('orders').doc(merchantTransactionId).update({
      status: 'confirmed',
      'payment.status': 'paid',
      confirmedOrderId: orderId,
    }).catch(() => { /* pending doc might not exist or already updated */ })
  );

  // ── 4. Fire-and-forget background jobs ──────────────────────────────────
  waitUntil(
    createShiprocketShipmentBackground(orderId, orderData)
      .catch(err => console.error('[shiprocket] Failed:', err))
  );

  waitUntil(
    syncToGoogleSheets(orderId, orderData)
      .catch(err => console.error('[sheetdb] Failed:', err))
  );

  waitUntil(
    sendConfirmationEmail(orderData, orderId)
      .catch(err => console.error('[email] Failed:', err))
  );

  return { orderId, alreadyExisted: false };
}

// ─── BACKGROUND: Shiprocket Shipment ───────────────────────────────────────

async function createShiprocketShipmentBackground(
  orderId: string,
  orderData: Omit<Order, 'id'>
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
      items: orderData.items.map((item) => ({
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

    console.log('[shiprocket] ✅ Complete:', orderId, '| AWB:', awb);

  } catch (err) {
    console.error('[shiprocket] ❌ Failed for order:', orderId, err);

    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.shiprocket': 'failed',
      'shiprocket.status': 'shiprocket_failed',
      'shiprocket.error': err instanceof Error ? err.message : 'Unknown error',
      'shiprocket.lastUpdated': new Date().toISOString(),
      'shiprocket.attempts': 1,
    }).catch(() => { });
  }
}

// ─── BACKGROUND: Google Sheets Sync ────────────────────────────────────────

async function syncToGoogleSheets(
  orderId: string,
  orderData: Omit<Order, 'id'>
): Promise<void> {
  console.log('[sheetdb] Syncing order to Google Sheets:', orderId);
  const { sheetdb } = await import('@/lib/sheetdb');

  try {
    await sheetdb.addOrder({
      orderId,
      createdAt: orderData.createdAt,
      userName: orderData.userName,
      userEmail: orderData.userEmail,
      phone: orderData.shippingAddress?.phone || '',
      total: orderData.total,
      paymentId: orderData.payment?.phonePeTransactionId || orderData.payment?.merchantTransactionId || '',
      items: orderData.items || [],
      shippingAddress: {
        line1: orderData.shippingAddress?.line1 || '',
        city: orderData.shippingAddress?.city || '',
        state: orderData.shippingAddress?.state || '',
        pincode: orderData.shippingAddress?.pincode || '',
      },
    });

    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.googleSheets': 'success'
    });
  } catch (err) {
    console.error('[sheetdb] Failed to sync order to Google Sheets:', err);
    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.googleSheets': 'failed'
    });
    throw err;
  }
}

// ─── BACKGROUND: Confirmation Email ────────────────────────────────────────

async function sendConfirmationEmail(
  orderData: Omit<Order, 'id'>,
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

  const paymentId = orderData.payment?.phonePeTransactionId
    || orderData.payment?.merchantTransactionId
    || '';

  try {
    await resend.emails.send({
      from: `Shivam Lifestyle <${process.env.RESEND_FROM_EMAIL || 'orders@shivamhookah.in'}>`,
      to: orderData.userEmail,
      subject: `Your order is confirmed - Shivam Lifestyle #${orderId}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;
                    background:#0a0a0a;color:#fff;padding:32px;border-radius:12px;">
          <h1 style="color:#d4af37;margin-bottom:4px;">Order Confirmed 🎉</h1>
          <p style="color:#999;margin-top:0;">Thank you for shopping with Shivam Lifestyle Accessories</p>
          
          <div style="background:#1a1a1a;padding:16px;border-radius:8px;margin:20px 0;">
            <p style="margin:4px 0;color:#888;font-size:13px;">
              <strong style="color:#fff;">Order ID:</strong> #${escapeHtml(orderId)}
            </p>
            <p style="margin:4px 0;color:#888;font-size:13px;">
              <strong style="color:#fff;">Payment ID:</strong> 
              ${escapeHtml(paymentId)}
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
            © 2026 Shivam Lifestyle Accessories · shivamhookah.in
          </p>
        </div>
      `,
    });

    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.email': 'success'
    });
    console.log('[email] ✅ Sent to:', orderData.userEmail);
  } catch (err) {
    console.error('[email] Failed:', err);
    await adminDb.collection('orders').doc(orderId).update({
      'backgroundTasks.email': 'failed'
    });
    throw err;
  }
}
