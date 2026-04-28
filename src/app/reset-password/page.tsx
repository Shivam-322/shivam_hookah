"use client";

import { useState, Suspense, useEffect } from "react";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
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
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Link from "next/link";

function ResetPasswordContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isValidCode, setIsValidCode] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode");

  useEffect(() => {
    if (oobCode) {
      verifyPasswordResetCode(auth, oobCode)
        .then(() => {
          setIsValidCode(true);
        })
        .catch(() => {
          setIsValidCode(false);
        })
        .finally(() => {
          setIsValidating(false);
        });
    } else {
      setIsValidating(false);
    }
  }, [oobCode]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) {
      toast.error("Invalid or missing password reset code.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters long.");
      return;
    }

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, password);
      toast.success("Password has been reset successfully!");
      router.push("/login");
    } catch (error: any) {
      console.error(error);
      toast.error("Failed to reset password. The link might be expired or invalid.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-border shadow-[0_0_40px_rgba(201,168,76,0.1)]">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-3xl font-bold tracking-widest text-primary font-serif">
          NEW PASSWORD
        </CardTitle>
        <CardDescription>
          Enter your new password below.
        </CardDescription>
      </CardHeader>
      
      {isValidating ? (
        <CardContent className="flex flex-col items-center justify-center py-10">
          <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground text-sm font-medium">Verifying your secure link...</p>
        </CardContent>
      ) : !oobCode || !isValidCode ? (
        <CardContent className="text-center pb-6">
          <p className="text-destructive font-medium mb-4">
            {!oobCode 
              ? "Invalid password reset link." 
              : "This reset link has expired or has already been used."}
          </p>
          <Link href="/forgot-password" className={buttonVariants({ variant: "outline" })}>
            Request a new link
          </Link>
        </CardContent>
      ) : (
        <>
          <CardContent>
            <form id="new-password-form" onSubmit={handleReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50 border-border"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="bg-background/50 border-border"
                />
              </div>
            </form>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full font-bold h-12 text-lg"
              type="submit"
              form="new-password-form"
              disabled={loading}
            >
              {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Reset Password"}
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="container mx-auto px-4 py-24 flex justify-center items-center min-h-[calc(100vh-200px)]">
      <Suspense fallback={<Loader2 className="h-12 w-12 animate-spin text-primary" />}>
        <ResetPasswordContent />
      </Suspense>
    </div>
  );
}
