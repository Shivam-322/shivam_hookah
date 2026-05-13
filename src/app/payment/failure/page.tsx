"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense } from "react";
import { Loader2, XCircle, AlertTriangle } from "lucide-react";

function FailureContent() {
  const searchParams = useSearchParams();
  const txnId = searchParams.get("txnid");
  const reason = searchParams.get("reason") || "PAYMENT_FAILED";

  // Map reason codes to user-friendly messages
  const getReasonMessage = (code: string) => {
    switch (code) {
      case "PAYMENT_CANCELLED":
        return "You cancelled the payment.";
      case "PAYMENT_DECLINED":
      case "BAD_REQUEST":
        return "Your bank declined the transaction.";
      case "TIMED_OUT":
        return "The payment request timed out.";
      case "amount_mismatch":
        return "A security issue was detected with the payment amount.";
      case "missing_txn_id":
        return "Transaction details could not be found.";
      case "server_error":
        return "A server error occurred during processing.";
      default:
        return "The payment could not be completed.";
    }
  };

  return (
    <div className="luxury-container section-padding min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8 sm:space-y-10" data-aos="zoom-in" suppressHydrationWarning>
        <div className="flex justify-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center shadow-[0_0_50px_rgba(239,68,68,0.2)]">
            <XCircle className="w-10 h-10 sm:w-12 sm:h-12 text-red-500" />
          </div>
        </div>

        <div className="space-y-3 sm:space-y-4">
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.3em] text-red-500 font-bold">
            Payment Failed
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-[0.05em] text-[#F5F5F5] font-serif uppercase break-words">
            Transaction Unsuccessful
          </h1>
          <p className="text-[#888888] text-sm sm:text-base uppercase tracking-[0.1em]">
            {getReasonMessage(reason)}
          </p>
        </div>

        {/* Possible reasons */}
        <div className="bg-[#111111] p-6 sm:p-8 border border-primary/10 rounded-sm text-left max-w-md mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-primary" />
            <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
              Possible Reasons
            </p>
          </div>
          <ul className="space-y-3 text-[11px] sm:text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Payment was cancelled by the user</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Bank declined the transaction</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Network timeout during payment processing</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Insufficient funds in the account</span>
            </li>
          </ul>

          {txnId && (
            <div className="mt-4 pt-4 border-t border-primary/10">
              <p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-1">
                Transaction ID
              </p>
              <p className="text-primary font-mono text-[10px] tracking-widest break-all">
                {txnId}
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-4 sm:pt-6">
          <Link href="/checkout" className="w-full sm:w-auto">
            <Button className="w-full px-8 sm:px-12 h-12 sm:h-14 font-bold text-[10px] sm:text-[11px] tracking-[0.2em] uppercase shadow-[0_10px_30px_rgba(201,168,76,0.15)] hover:shadow-[0_15px_40px_rgba(201,168,76,0.25)] transition-all">
              Try Again
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button
              variant="outline"
              className="w-full px-8 sm:px-12 h-12 sm:h-14 font-bold text-[10px] sm:text-[11px] tracking-[0.2em] uppercase border-primary/20 hover:bg-primary/5 hover:border-primary/50 text-primary"
            >
              Return Home
            </Button>
          </Link>
        </div>

        <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-[0.1em] pt-4">
          Your cart has been preserved. Need help?{" "}
          <a
            href="mailto:orders@shivamhookah.in"
            className="text-primary hover:underline"
          >
            Contact Support
          </a>
        </p>
      </div>
    </div>
  );
}

export default function PaymentFailurePage() {
  return (
    <Suspense
      fallback={
        <div className="luxury-container section-padding text-center min-h-[80vh] flex items-center justify-center">
          <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto" />
        </div>
      }
    >
      <FailureContent />
    </Suspense>
  );
}
