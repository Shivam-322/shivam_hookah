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

    // ── Delete from ImageKit ──────────────────────────────────────────────
    const { fileId } = await req.json();

    if (!fileId) {
      return NextResponse.json({ error: "No fileId provided" }, { status: 400 });
    }

    await imagekit.deleteFile(fileId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[API Error] ImageKit delete error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
