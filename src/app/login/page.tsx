"use client";

import { useState, useEffect, Suspense } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, GoogleAuthProvider, signInWithPopup } from "@/lib/firebase";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

/** Firebase error code → user-friendly message */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-login-credentials": "Incorrect email or password.",
  "auth/invalid-email":             "Please enter a valid email address.",
  "auth/user-not-found":            "No account found. Please sign up.",
  "auth/wrong-password":            "Incorrect password. Please try again.",
  "auth/email-already-in-use":      "An account with this email already exists.",
  "auth/weak-password":             "Password must be at least 6 characters.",
  "auth/user-disabled":             "This account has been disabled.",
  "auth/too-many-requests":         "Too many attempts. Try again later.",
  "auth/network-request-failed":    "Network error. Check your connection.",
};

/** Inline Google logo SVG */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 mr-2 flex-shrink-0" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user) {
      router.push(redirect);
    }
  }, [user, authLoading, router, redirect]);

  /** Google Sign-In — popup flow */
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save to Firestore only if first time
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: user.uid,
          name: user.displayName,
          email: user.email,
          photo: user.photoURL,
          createdAt: serverTimestamp(),
        });
      }

      toast.success("Signed in with Google!");
      router.push(redirect);
    } catch (err: any) {
      console.error("Google popup initiation error:", err);
      const message =
        AUTH_ERROR_MESSAGES[err?.code] ?? "Something went wrong. Try again.";
      toast.error(message);
    } finally {
      setGoogleLoading(false);
    }
  };

  /** Email / Password sign-in */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Successfully logged in!");
      router.push(redirect);
    } catch (error: any) {
      const message =
        AUTH_ERROR_MESSAGES[error?.code] ?? "Something went wrong. Try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-primary/20 bg-[#111111] shadow-[0_20px_50px_rgba(0,0,0,0.5)] rounded-sm" data-aos="zoom-in">
      <CardHeader className="space-y-4 text-center pb-6 sm:pb-8 border-b border-primary/10">
        <div className="flex flex-col items-center">
          <span className="text-[10px] uppercase tracking-[0.3em] text-primary font-bold mb-2">Welcome Back</span>
          <CardTitle className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-[0.1em] text-[#F5F5F5] font-serif uppercase">
            Shivam Hookah
          </CardTitle>
        </div>
        <CardDescription className="text-muted-foreground uppercase text-[9px] sm:text-[10px] tracking-[0.1em]">Access your private collection</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 sm:space-y-8 pt-6 sm:pt-8">
        {/* ── Google Sign-In ─────────────────────────────────────────── */}
        <div className="space-y-4">
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 sm:h-14 border-primary/20 bg-black/20 hover:bg-primary/10 hover:border-primary/50 text-[#F5F5F5] font-bold text-[10px] sm:text-[11px] tracking-[0.2em] uppercase flex items-center justify-center transition-all rounded-sm"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </Button>
        </div>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-primary/10"></span>
          </div>
          <div className="relative flex justify-center text-[9px] sm:text-[10px] uppercase tracking-[0.2em]">
            <span className="bg-[#111111] px-3 sm:px-4 text-muted-foreground font-bold">Or Secure Login</span>
          </div>
        </div>

        {/* ── Email / Password form ──────────────────────────────────── */}
        <form id="login-form" onSubmit={handleLogin} className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Registered Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/20 border-primary/10 focus-visible:border-primary/50 h-11 sm:h-12"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Secret Password</Label>
              <Link 
                href="/forgot-password" 
                className="text-[9px] sm:text-[10px] font-bold text-primary uppercase tracking-[0.1em] hover:underline"
              >
                Forgot?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-black/20 border-primary/10 focus-visible:border-primary/50 h-11 sm:h-12"
            />
          </div>
        </form>
      </CardContent>

      <CardFooter className="flex flex-col space-y-4 sm:space-y-6 pb-8 sm:pb-10">
        <Button
          className="w-full font-bold text-[11px] sm:text-[12px] tracking-[0.2em] h-12 sm:h-14 uppercase shadow-[0_10px_30px_rgba(201,168,76,0.15)] hover:shadow-[0_15px_40px_rgba(201,168,76,0.25)] transition-all"
          type="submit"
          form="login-form"
          disabled={loading}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Authorize Entry"}
        </Button>
        <div className="text-center text-[10px] sm:text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          New to the club?{" "}
          <Link
            href={`/signup?redirect=${encodeURIComponent(redirect)}`}
            className="text-primary hover:underline font-bold"
          >
            Create account
          </Link>
        </div>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="luxury-container section-padding flex justify-center items-center min-h-[calc(100vh-200px)] px-4">
      <Suspense fallback={<Loader2 className="h-12 w-12 animate-spin text-primary" />}>
        <LoginContent />
      </Suspense>
    </div>
  );
}