"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { Button, buttonVariants } from "@/components/ui/button";
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setIsSent(true);
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error: any) {
      console.error(error);
      const message = error?.code === "auth/user-not-found"
        ? "No user found with this email."
        : "Failed to send reset email. Please try again.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-24 flex justify-center items-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md border-border shadow-[0_0_40px_rgba(201,168,76,0.1)]">
        <CardHeader className="space-y-1 text-center">
          <CardTitle className="text-3xl font-bold tracking-widest text-primary font-serif">
            RESET PASSWORD
          </CardTitle>
          <CardDescription>
            {isSent
              ? "Check your email for a link to reset your password. If it doesn’t appear within a few minutes, check your spam folder."
              : "Enter your email address and we will send you a link to reset your password."}
          </CardDescription>
        </CardHeader>
        {!isSent ? (
          <>
            <CardContent>
              <form id="reset-form" onSubmit={handleReset} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50 border-border"
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button
                className="w-full font-bold h-12 text-lg"
                type="submit"
                form="reset-form"
                disabled={loading}
              >
                {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Send Reset Link"}
              </Button>
              <div className="text-center text-sm">
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="text-primary hover:underline font-medium"
                >
                  Sign in
                </Link>
              </div>
            </CardFooter>
          </>
        ) : (
          <CardFooter className="flex flex-col space-y-4 pb-8">
            <Link href="/login" className={buttonVariants({ className: "w-full font-bold h-12 text-lg" })}>
              Return to Sign In
            </Link>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
