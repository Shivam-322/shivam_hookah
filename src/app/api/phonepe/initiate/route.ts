import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { generateChecksum } from '@/lib/phonepe';
import type { PhonePePaymentRequest, PhonePeResponse } from '@/lib/phonepe';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';

const CheckoutSchema = z.object({
  items: z.array(
    z.object({
      productId: z.string()
        .min(1, "Product ID required")
        .max(100, "Product ID too long"),
      quantity: z.number()
        .int("Quantity must be a whole number")
        .min(1, "Minimum quantity is 1")
        .max(100, "Maximum quantity is 100"),
      color: z.string().optional(),
    })
  ).min(1, "Cart cannot be empty")
   .max(20, "Too many items in cart"),
  
  shippingAddress: z.object({
    name: z.string()
      .min(2, "Name too short")
      .max(100, "Name too long"),
    email: z.string()
      .email("Invalid email address").optional(),
    phone: z.string()
      .regex(
        /^[6-9]\d{9}$/, 
        "Invalid Indian phone number"
      ),
    address: z.string()
      .min(10, "Address too short")
      .max(300, "Address too long").optional(),
    line1: z.string()
      .min(10, "Address too short")
      .max(300, "Address too long").optional(),
    city: z.string()
      .min(2, "City required")
      .max(100),
    state: z.string()
      .min(2, "State required")
      .max(100),
    pincode: z.string()
      .regex(/^\d{6}$/, "Invalid pincode"),
  })
});

export const runtime = 'nodejs';
export const preferredRegion = 'bom1'; // Mumbai — closest to Shiprocket
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  // ── 1. Verify Firebase auth token ───────────────────────────────────────────
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

  const userId = decodedToken.uid;

  // ── 2. Parse and validate request body ──────────────────────────────────────
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const validation = CheckoutSchema.safeParse(body);
  
  if (!validation.success) {
    return NextResponse.json(
      { 
        error: "Invalid request",
        details: validation.error.flatten()
      },
      { status: 400 }
    );
  }

  const { items, shippingAddress } = validation.data;
  if (!shippingAddress.line1 && shippingAddress.address) {
    (shippingAddress as any).line1 = shippingAddress.address;
  }

  // ── 3. Calculate total SERVER-SIDE from Firestore prices ────────────────────
  // NEVER trust prices from the client
  let total = 0;
  const verifiedItems: any[] = [];

  console.log('[phonepe-initiate] Starting price verification');

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

      if (product.stock < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for: ${product.name}` },
          { status: 400 }
        );
      }

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
    console.error('[phonepe-initiate] Product verification failed:', err);
    return NextResponse.json(
      { error: 'Failed to verify products' },
      { status: 500 }
    );
  }

  console.log(`[phonepe-initiate] Verification complete. ${verifiedItems.length} items. Total: ₹${total}`);

  // ── 4. Convert to paise ─────────────────────────────────────────────────────
  const amountInPaise = Math.round(total * 100);

  // ── 5. Generate unique merchant transaction ID ──────────────────────────────
  // Max 38 chars, alphanumeric + underscore only
  const merchantTransactionId = `MT_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  // ── 6. Build PhonePe payload ────────────────────────────────────────────────
  const payload: PhonePePaymentRequest = {
    merchantId: process.env.PHONEPE_MERCHANT_ID!,
    merchantTransactionId,
    merchantUserId: `USER_${userId}`,
    amount: amountInPaise,
    redirectUrl: process.env.PHONEPE_REDIRECT_URL!,
    redirectMode: 'REDIRECT',
    callbackUrl: process.env.PHONEPE_CALLBACK_URL!,
    mobileNumber: shippingAddress.phone?.replace(/\D/g, '').slice(-10) || undefined,
    paymentInstrument: {
      type: 'PAY_PAGE',
    },
  };

  // ── 7. Generate checksum ────────────────────────────────────────────────────
  const payloadString = JSON.stringify(payload);
  const base64Payload = Buffer.from(payloadString).toString('base64');

  const checksum = generateChecksum(
    payloadString,
    '/pg/v1/pay',
    process.env.PHONEPE_SALT_KEY!,
    process.env.PHONEPE_SALT_INDEX!
  );

  // ── 8. Call PhonePe API ─────────────────────────────────────────────────────
  try {
    const phonePeRes = await fetch(
      `${process.env.PHONEPE_BASE_URL}/pg/v1/pay`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-VERIFY': checksum,
          'X-MERCHANT-ID': process.env.PHONEPE_MERCHANT_ID!,
        },
        body: JSON.stringify({ request: base64Payload }),
      }
    );

    const phonePeData: PhonePeResponse = await phonePeRes.json();

    if (!phonePeData.success || !phonePeData.data?.instrumentResponse?.redirectInfo?.url) {
      console.error('[phonepe-initiate] PhonePe API failed:', phonePeData);
      return NextResponse.json(
        { error: phonePeData.message || 'Failed to initiate PhonePe payment' },
        { status: 500 }
      );
    }

    // ── 9. Store PENDING order in Firestore ─────────────────────────────────
    await adminDb.collection('orders').doc(merchantTransactionId).set({
      status: 'pending',
      payment: {
        gateway: 'phonepe',
        merchantTransactionId,
        expectedAmount: total,
        expectedAmountPaise: amountInPaise,
        status: 'pending',
      },
      items: verifiedItems,
      shippingAddress: {
        name: shippingAddress.name || '',
        phone: shippingAddress.phone || '',
        line1: shippingAddress.line1 || '',
        city: shippingAddress.city || '',
        state: shippingAddress.state || '',
        pincode: shippingAddress.pincode || '',
      },
      userId,
      userEmail: decodedToken.email || '',
      userName: shippingAddress.name || '',
      total,
      createdAt: FieldValue.serverTimestamp(),
    });

    console.log('[phonepe-initiate] ✅ Pending order stored, redirecting to PhonePe');

    // ── 10. Return redirect URL to frontend and set cookie ──────────────────
    const response = NextResponse.json({
      success: true,
      redirectUrl: phonePeData.data.instrumentResponse.redirectInfo.url,
      merchantTransactionId,
    });
    
    response.cookies.set(
      "phonepe_txn_id", 
      merchantTransactionId,
      { 
        httpOnly: true, 
        maxAge: 600, // 10 minutes
        sameSite: "lax",
        path: "/"
      }
    );
    
    return response;

  } catch (err) {
    console.error('[phonepe-initiate] PhonePe API call failed:', err);
    return NextResponse.json(
      { error: 'Failed to initiate payment' },
      { status: 500 }
    );
  }
}
