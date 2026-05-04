import { NextRequest, NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

import crypto from 'crypto';

export const runtime = 'nodejs';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

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

  // Step 2 — Parse and validate request body
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { items, shippingAddress } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
  }

  if (!shippingAddress) {
    return NextResponse.json({ error: 'Shipping address is required' }, { status: 400 });
  }

  // Step 3 — Calculate total SERVER-SIDE from Firestore prices
  // NEVER trust prices from the client
  let total = 0;
  const verifiedItems: any[] = [];

  try {
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return NextResponse.json(
          { error: `Invalid item: ${item.productId}` },
          { status: 400 }
        );
      }

      const productDoc = await adminDb.collection('products').doc(item.productId).get();

      if (!productDoc.exists) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 404 }
        );
      }

      const product = productDoc.data()!;

      // if (product.stock < item.quantity) {
      //   return NextResponse.json(
      //     { error: `Insufficient stock for: ${product.name}` },
      //     { status: 400 }
      //   );
      // }

      total += product.price * item.quantity;

      verifiedItems.push({
        productId: item.productId,
        name: product.name,
        price: product.price,
        quantity: item.quantity,
        imageUrl: product.imageUrl || '',
        color: item.color || '',
      });
    }
  } catch (err) {
    console.error('[create-order] Product verification failed:', err);
    return NextResponse.json(
      { error: 'Failed to verify products' },
      { status: 500 }
    );
  }

  // Step 4 — Create Razorpay order
  // Amount must be in paise (1 INR = 100 paise)
  try {
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(total * 100), // paise
      currency: 'INR',
      receipt: `order_${Date.now()}`,
      notes: {
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        userName: shippingAddress.name || '',
        shippingName: shippingAddress.name || '',
        shippingPhone: shippingAddress.phone || '',
        shippingLine1: shippingAddress.line1 || '',
        shippingCity: shippingAddress.city || '',
        shippingState: shippingAddress.state || '',
        shippingPincode: shippingAddress.pincode || '',
        items: JSON.stringify(verifiedItems),
      },
    });

    console.log('[create-order] Razorpay order created:', razorpayOrder.id);

    return NextResponse.json({
      success: true,
      orderId: razorpayOrder.id,        // rzp_order_xxx
      amount: razorpayOrder.amount,     // in paise
      currency: razorpayOrder.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      // Send verified data back so checkout can use it
      verifiedItems,
      total,
    });

  } catch (err) {
    console.error('[create-order] Razorpay order creation failed:', err);
    return NextResponse.json(
      { error: 'Failed to create payment order' },
      { status: 500 }
    );
  }
}
