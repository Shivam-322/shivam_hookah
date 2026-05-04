"use client";

import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function SuccessContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const [razorpayPaymentId, setRazorpayPaymentId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      if (!orderId) return;
      try {
        const orderDoc = await getDoc(doc(db, "orders", orderId));
        if (orderDoc.exists()) {
          // Use nested payment field
          setRazorpayPaymentId(orderDoc.data().payment?.razorpayPaymentId || null);
        }
      } catch (err) {
        // console.error("Failed to fetch order");
      }
    }
    fetchOrder();
  }, [orderId]);

  return (
    <div className="luxury-container section-padding min-h-[80vh] flex items-center justify-center px-4">
      <div className="max-w-2xl w-full text-center space-y-8 sm:space-y-10" data-aos="zoom-in">
        <div className="flex justify-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center shadow-[0_0_50px_rgba(201,168,76,0.3)]">
            <CheckCircle2 className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
          </div>
        </div>
        
        <div className="space-y-3 sm:space-y-4">
          <span className="section-label">Session Confirmed</span>
          <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold tracking-[0.05em] text-[#F5F5F5] font-serif uppercase break-words">
            Order Secured
          </h1>
          <p className="text-[#888888] text-base sm:text-lg uppercase tracking-[0.1em]">
            Your masterpiece is being prepared for transit.
          </p>
        </div>

        {orderId && (
          <div className="bg-[#111111] p-4 sm:p-6 border border-primary/10 rounded-sm inline-block w-full sm:w-auto">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2">Order ID</p>
            <p className="text-primary font-mono text-xs sm:text-sm tracking-widest break-all px-2">{orderId}</p>
            {razorpayPaymentId && (
              <>
                <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold mb-2 mt-4">Payment ID</p>
                <p className="text-primary font-mono text-xs sm:text-sm tracking-widest break-all px-2">{razorpayPaymentId}</p>
              </>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 pt-6 sm:pt-10">
          <Link href="/catalog" className="w-full sm:w-auto">
            <Button className="w-full px-8 sm:px-12 h-12 sm:h-14 font-bold text-[10px] sm:text-[11px] tracking-[0.2em] uppercase shadow-[0_10px_30px_rgba(201,168,76,0.15)] hover:shadow-[0_15px_40px_rgba(201,168,76,0.25)] transition-all">
              Continue Collection
            </Button>
          </Link>
          <Link href="/" className="w-full sm:w-auto">
            <Button variant="outline" className="w-full px-8 sm:px-12 h-12 sm:h-14 font-bold text-[10px] sm:text-[11px] tracking-[0.2em] uppercase border-primary/20 hover:bg-primary/5 hover:border-primary/50 text-primary">
              Return Home
            </Button>
          </Link>
        </div>
        
        <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-[0.2em] pt-6 sm:pt-8">
          A confirmation invitation has been sent to your email.
        </p>
      </div>
    </div>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="luxury-container section-padding text-center">
          <Loader2 className="animate-spin h-12 w-12 text-primary mx-auto" />
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
