import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { shiprocket } from '@/lib/shiprocket';
import { sheetdb } from '@/lib/sheetdb';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  // Verify admin
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.split('Bearer ')[1];

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const adminEmails = [
      process.env.NEXT_PUBLIC_ADMIN_EMAIL_1,
      process.env.NEXT_PUBLIC_ADMIN_EMAIL_2,
    ];
    if (!adminEmails.includes(decoded.email!)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  const { orderId } = await req.json();

  if (!orderId) {
    return NextResponse.json({ error: 'orderId required' }, { status: 400 });
  }

  const orderRef = adminDb.collection('orders').doc(orderId);
  const orderSnap = await orderRef.get();

  if (!orderSnap.exists) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const orderData = orderSnap.data()!;

  try {
    const shipment = await shiprocket.createShipment({
      orderId,
      orderDate: new Date(orderData.createdAt).toISOString().split('T')[0],
      customerName: orderData.shippingAddress?.name || orderData.userName,
      customerEmail: orderData.userEmail,
      customerPhone: orderData.shippingAddress?.phone || '',
      shippingAddress: orderData.shippingAddress,
      items: (orderData.items || []).map((item: any) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      totalAmount: orderData.total,
    });

    let awb = shipment.awb;
    let courierName = shipment.courierName;

    if (shipment.shipmentId && !awb) {
      const awbData = await shiprocket.generateAWB(shipment.shipmentId);
      awb = awbData.awb;
      courierName = awbData.courierName;
    }

    let labelUrl = '';
    if (shipment.shipmentId) {
      try {
        labelUrl = await shiprocket.generateLabel(shipment.shipmentId);
      } catch {
        // non-critical
      }
    }

    // Update Firestore with nested dot notation
    await orderRef.update({
      'shiprocket.orderId': shipment.shiprocketOrderId,
      'shiprocket.shipmentId': shipment.shipmentId,
      'shiprocket.awb': awb || null,
      'shiprocket.courierName': courierName || null,
      'shiprocket.labelUrl': labelUrl || null,
      'shiprocket.status': 'shipment_created',
      'shiprocket.statusLabel': 'Shipment Created',
      'shiprocket.error': null,
      'shiprocket.lastUpdated': new Date().toISOString(),
      'shiprocket.attempts': (orderData.shiprocket?.attempts || 0) + 1,
    });

    // Sync to Google Sheets
    await sheetdb.updateOrderStatus(orderId, {
      shiprocketId: shipment.shiprocketOrderId,
      awb: awb || '',
      courier: courierName || '',
      shippingStatus: 'Shipment Created',
      labelUrl: labelUrl || '',
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      awb,
      courierName,
      labelUrl,
      shiprocketOrderId: shipment.shiprocketOrderId,
      shipmentId: shipment.shipmentId,
    });

  } catch (err) {
    console.error('[retry-shipment] Failed:', err);

    // Update Firestore with nested dot notation on failure
    await orderRef.update({
      'shiprocket.status': 'shiprocket_failed',
      'shiprocket.error': err instanceof Error ? err.message : 'Retry failed',
      'shiprocket.lastUpdated': new Date().toISOString(),
      'shiprocket.attempts': (orderData.shiprocket?.attempts || 0) + 1,
    });

    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Retry failed' },
      { status: 500 }
    );
  }
}
