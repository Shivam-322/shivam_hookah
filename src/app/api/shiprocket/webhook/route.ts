import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { sheetdb } from '@/lib/sheetdb';

export const runtime = 'nodejs';

// Shiprocket sends these status codes in their webhooks
// Map them to our internal status system
const SHIPROCKET_STATUS_MAP: Record<string, {
  orderStatus: string;
  shippingStatus: string;
  label: string;
}> = {
  // In Transit statuses
  'PICKUP PENDING':        { orderStatus: 'shipped',   shippingStatus: 'pickup_pending',    label: 'Pickup Pending' },
  'PICKUP QUEUED':         { orderStatus: 'shipped',   shippingStatus: 'pickup_queued',     label: 'Pickup Queued' },
  'PICKED UP':             { orderStatus: 'shipped',   shippingStatus: 'picked_up',         label: 'Picked Up' },
  'IN TRANSIT':            { orderStatus: 'shipped',   shippingStatus: 'in_transit',        label: 'In Transit' },
  'OUT FOR DELIVERY':      { orderStatus: 'shipped',   shippingStatus: 'out_for_delivery',  label: 'Out for Delivery' },
  'DELIVERED':             { orderStatus: 'delivered', shippingStatus: 'delivered',         label: 'Delivered' },
  
  // Problem statuses
  'UNDELIVERED':           { orderStatus: 'shipped',   shippingStatus: 'undelivered',       label: 'Undelivered' },
  'DELIVERY FAILED':       { orderStatus: 'shipped',   shippingStatus: 'delivery_failed',   label: 'Delivery Failed' },
  'RTO INITIATED':         { orderStatus: 'shipped',   shippingStatus: 'rto_initiated',     label: 'RTO Initiated' },
  'RTO DELIVERED':         { orderStatus: 'shipped',   shippingStatus: 'rto_delivered',     label: 'RTO Delivered' },
  'LOST':                  { orderStatus: 'shipped',   shippingStatus: 'lost',              label: 'Lost' },
  'DAMAGED':               { orderStatus: 'shipped',   shippingStatus: 'damaged',           label: 'Damaged' },
  
  // Cancelled
  'CANCELLED':             { orderStatus: 'cancelled', shippingStatus: 'cancelled',         label: 'Cancelled' },
};

export async function POST(req: NextRequest) {
  let body: any;

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  console.log('[shiprocket-webhook] Received event:', JSON.stringify(body, null, 2));

  // Extract data from Shiprocket webhook payload
  // Shiprocket sends different payload shapes — handle both
  const awb = body.awb || body.AWB || body.shipment_track?.[0]?.awb_code;
  const currentStatus = (
    body.current_status || 
    body.status || 
    body.shipment_status ||
    body.shipment_track?.[0]?.current_status ||
    ''
  ).toUpperCase().trim();

  if (!awb) {
    console.log('[shiprocket-webhook] No AWB in payload, skipping');
    return NextResponse.json({ received: true }, { status: 200 });
  }

  if (!currentStatus) {
    console.log('[shiprocket-webhook] No status in payload, skipping');
    return NextResponse.json({ received: true }, { status: 200 });
  }

  console.log('[shiprocket-webhook] AWB:', awb, '| Status:', currentStatus);

  // Find the order in Firestore by nested AWB field
  try {
    const ordersRef = adminDb.collection('orders');
    const q = ordersRef.where('shiprocket.awb', '==', awb);
    const snapshot = await q.get();

    if (snapshot.empty) {
      console.log('[shiprocket-webhook] No order found for AWB:', awb);
      // Still return 200 so Shiprocket stops retrying
      return NextResponse.json({ received: true }, { status: 200 });
    }

    const orderDoc = snapshot.docs[0];
    const orderId = orderDoc.id;

    // Map Shiprocket status to our status
    const statusMapping = SHIPROCKET_STATUS_MAP[currentStatus];

    if (!statusMapping) {
      console.log('[shiprocket-webhook] Unknown status:', currentStatus, '— storing raw');
      // Store unknown status as-is without changing order status
      await adminDb.collection('orders').doc(orderId).update({
        'shiprocket.status': currentStatus.toLowerCase().replace(/ /g, '_'),
        'shiprocket.statusLabel': currentStatus,
        'shiprocket.lastUpdated': new Date().toISOString(),
      });
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // Update Firestore order with nested status fields
    const updateData: Record<string, any> = {
      status: statusMapping.orderStatus,
      'shiprocket.status': statusMapping.shippingStatus,
      'shiprocket.statusLabel': statusMapping.label,
      'shiprocket.lastUpdated': new Date().toISOString(),
    };

    // Add delivery timestamp if delivered
    if (statusMapping.shippingStatus === 'delivered') {
      updateData.deliveredAt = new Date().toISOString();
    }

    if (body.status_id) {
      updateData['shiprocket.statusCode'] = Number(body.status_id);
    }

    if (body.etd || body.expected_delivery_date) {
      updateData['shiprocket.etd'] = body.etd || body.expected_delivery_date;
    }

    await adminDb.collection('orders').doc(orderId).update(updateData);

    console.log('[shiprocket-webhook] Order', orderId, 'updated to:', statusMapping.label);

    // Sync to Google Sheets
    try {
      await sheetdb.updateOrderStatus(orderId, {
        orderStatus: statusMapping.orderStatus.charAt(0).toUpperCase() 
          + statusMapping.orderStatus.slice(1),
        shippingStatus: statusMapping.label,
      });
    } catch (sheetErr) {
      console.error('[sheetdb] Webhook sheet update failed:', sheetErr);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (err) {
    console.error('[shiprocket-webhook] Error processing webhook:', err);
    // Return 200 anyway — Shiprocket will retry on non-200 responses
    // which could cause duplicate processing
    return NextResponse.json({ received: true }, { status: 200 });
  }
}

// Shiprocket sometimes sends GET to verify the endpoint
export async function GET() {
  return NextResponse.json({ status: 'Shiprocket webhook active' }, { status: 200 });
}

/*
SETUP INSTRUCTIONS:

1. Deploy to Vercel first
2. Go to Shiprocket Dashboard → Settings → API
3. Find "Webhook URL" or "Notify URL" section
4. Add: https://your-site.vercel.app/api/shiprocket/webhook
5. Save settings

Shiprocket will now POST to this URL on every status change.
For local testing, use ngrok:
ngrok http 3000
Then add the ngrok URL to Shiprocket webhook settings temporarily.
*/
