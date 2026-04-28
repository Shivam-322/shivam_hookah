import { NextRequest, NextResponse } from "next/server";
import ImageKit from "imagekit";
import { adminAuth } from "@/lib/firebase-admin";

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY!,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY!,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT!,
});

const ADMIN_EMAILS = [
  process.env.ADMIN_EMAIL_1,
  process.env.ADMIN_EMAIL_2,
].filter(Boolean) as string[];

export async function POST(req: NextRequest) {
  try {
    // ── Auth: verify Firebase ID token from Authorization header ─────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing auth token" }, { status: 401 });
    }

    const idToken = authHeader.slice(7);

    // Verify token with Firebase Admin SDK
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const userEmail = decodedToken.email;

    if (!userEmail || !ADMIN_EMAILS.includes(userEmail)) {
      return NextResponse.json({ error: "Unauthorized: admin only" }, { status: 403 });
    }

    // ── Upload ────────────────────────────────────────────────────────────
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPEG, PNG, and WebP are allowed.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await imagekit.upload({
      file: buffer,
      fileName: file.name || "product-image",
      folder: "/ecommerce-products",
    });

    return NextResponse.json({ imageUrl: result.url, fileId: result.fileId });
  } catch (error: any) {
    console.error("[API Error] ImageKit upload error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
