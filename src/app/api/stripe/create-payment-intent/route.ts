import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as any,
});

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.split("Bearer ")[1];

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const authUserId = decodedToken.uid;

    const { amount, items, userId, userEmail, userName, shippingAddress } = await req.json();

    if (authUserId !== userId) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    if (!items || !Array.isArray(items) || items.length === 0 || !userId || !userEmail || !shippingAddress) {
      return NextResponse.json(
        { error: "Missing or invalid required fields" },
        { status: 400 }
      );
    }

    let calculatedTotal = 0;
    for (const item of items) {
      if (!item.productId || !item.quantity) continue;
      const productDoc = await adminDb.collection("products").doc(item.productId).get();
      if (productDoc.exists) {
        const data = productDoc.data();
        calculatedTotal += (data?.price || 0) * item.quantity;
      } else {
        return NextResponse.json(
          { error: `Product not found: ${item.name}` },
          { status: 400 }
        );
      }
    }

    if (calculatedTotal <= 0) {
      return NextResponse.json(
        { error: "Invalid order total" },
        { status: 400 }
      );
    }

    // Amount is in ₹ — Stripe expects paise (smallest INR unit)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(calculatedTotal * 100),
      currency: "inr",
      metadata: {
        userId,
        userEmail,
        userName: userName || "",
        shippingAddress: typeof shippingAddress === "string" ? shippingAddress.slice(0, 500) : JSON.stringify(shippingAddress).slice(0, 500),
        items: JSON.stringify(items).slice(0, 500), // Max 500 chars for Stripe metadata
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error: any) {
    console.error("[API Error] Stripe create-payment-intent:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
