"use client";

import { useCartStore } from "@/store/useCartStore";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

const stripeAppearance = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#C9A84C",
    colorBackground: "#111111",
    colorText: "#F5F5F5",
    colorDanger: "#ff4444",
    fontFamily: "Inter, sans-serif",
    borderRadius: "2px",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Inner payment form — rendered inside <Elements> provider
// ─────────────────────────────────────────────────────────────────────────────
interface PaymentFormProps {
  name: string;
  address: string;
  phone: string;
  total: number;
  userId: string;
  userEmail: string;
  onSuccess: (orderId: string) => void;
}

function StripePaymentForm({
  name,
  address,
  phone,
  total,
  userId,
  userEmail,
  onSuccess,
}: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const [stripeReady, setStripeReady] = useState(false);
  const { items, clearCart } = useCartStore();

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements || !stripeReady) return;

    setPaying(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        toast.error(submitError.message || "Failed to submit payment form.");
        setPaying(false);
        return;
      }

      const { error: stripeError, paymentIntent } =
        await stripe.confirmPayment({
          elements,
          redirect: "if_required",
        });

      if (stripeError) {
        toast.error(stripeError.message || "Payment failed. Please try again.");
        setPaying(false);
        return;
      }

      if (!paymentIntent || paymentIntent.status !== "succeeded") {
        toast.error("Payment incomplete. Please try again.");
        setPaying(false);
        return;
      }

      toast.success("Payment successful! Confirming your order...");
      clearCart();
      onSuccess(paymentIntent.id);
    } catch (error: any) {
      console.error("Payment confirmation error:", error);
      toast.error(error.message || "Something went wrong. Please try again.");
      setPaying(false);
    }
  };

  return (
    <form onSubmit={handleConfirm} className="space-y-6">
      <div className="bg-black/40 border border-primary/10 rounded-sm p-4 sm:p-6 shadow-inner overflow-hidden">
        <PaymentElement
          onReady={() => setStripeReady(true)}
          options={{
            layout: "tabs",
          }}
        />
      </div>
      <Button
        type="submit"
        disabled={!stripe || !elements || !stripeReady || paying}
        className={`w-full font-bold text-[11px] sm:text-[12px] tracking-[0.2em] h-14 sm:h-16 uppercase shadow-[0_10px_30px_rgba(201,168,76,0.15)] hover:shadow-[0_15px_40px_rgba(201,168,76,0.25)] transition-all ${!stripeReady ? 'opacity-50' : ''}`}
      >
        {!stripeReady ? (
          "Securing Connection..."
        ) : paying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          `Authorize ₹${total.toLocaleString("en-IN")}`
        )}
      </Button>
      <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center uppercase tracking-[0.1em]">
        🔒 Secure Encrypted Transaction — Verified by Stripe
      </p>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main checkout page
// ─────────────────────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const { items, getTotal } = useCartStore();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [line1, setLine1] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentLoading, setIntentLoading] = useState(false);
  const [step, setStep] = useState<"address" | "payment">("address");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/checkout");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        setEmail(user.email || "");
        try {
          const docRef = doc(db, "users", user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setName(data.name || "");
            setPhone(data.phone || "");
            setLine1(data.address || "");
            setCity(data.city || "");
            setState(data.state || "");
            setPincode(data.pincode || "");
          }
        } catch (error) {
          console.error("Error fetching user data", error);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  const handleProceedToPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }

    setIntentLoading(true);
    try {
      const token = await user?.getIdToken();
      if (!token) throw new Error("Authentication error");

      const res = await fetch("/api/stripe/create-payment-intent", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: getTotal(),
          items,
          userId: user!.uid,
          userEmail: user!.email,
          userName: name,
          shippingAddress: JSON.stringify({ line1, city, state, pincode, phone, name }),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to initialize payment");
      }

      const { clientSecret: secret } = await res.json();
      setClientSecret(secret);
      setStep("payment");
    } catch (error: any) {
      toast.error(error.message || "Failed to initialize payment");
    } finally {
      setIntentLoading(false);
    }
  };

  const handleOrderSuccess = useCallback(
    (orderId: string) => {
      router.push(`/order-success?orderId=${orderId}`);
    },
    [router]
  );

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  return (
    <div className="luxury-container section-padding min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start mb-10 sm:mb-12" data-aos="fade-up">
        <span className="section-label">Safe & Secure</span>
        <div className="section-label-hr"></div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[0.05em] text-[#F5F5F5] font-serif mt-2 sm:mt-4 uppercase">
          Checkout
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 sm:gap-16 lg:gap-20 items-start">
        {/* Main form column */}
        <div className="space-y-8 sm:space-y-10 order-2 lg:order-1" data-aos="fade-right">
          {step === "address" ? (
            <div className="bg-[#111111] p-6 sm:p-8 md:p-10 border border-primary/10 rounded-sm">
              <h2 className="text-lg sm:text-xl font-bold tracking-[0.1em] font-serif text-primary uppercase mb-6 sm:mb-8 border-b border-primary/10 pb-4">
                Delivery Details
              </h2>
              <form id="address-form" onSubmit={handleProceedToPayment} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Full Name</Label>
                    <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="Your name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Phone Number</Label>
                    <Input id="phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="+91" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Email Address</Label>
                  <Input id="email" type="email" required value={email} disabled className="bg-black/10 border-primary/10 opacity-50 cursor-not-allowed" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="line1" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Street Address</Label>
                  <Input id="line1" required value={line1} onChange={(e) => setLine1(e.target.value)} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="House No, Street, Area" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">City</Label>
                    <Input id="city" required value={city} onChange={(e) => setCity(e.target.value)} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="City" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">State</Label>
                    <Input id="state" required value={state} onChange={(e) => setState(e.target.value)} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="State" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pincode" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Pincode</Label>
                    <Input id="pincode" required value={pincode} onChange={(e) => setPincode(e.target.value)} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="000000" />
                  </div>
                </div>
                <Button type="submit" className="w-full font-bold text-[11px] sm:text-[12px] tracking-[0.2em] h-14 sm:h-16 uppercase shadow-[0_10px_30px_rgba(201,168,76,0.15)] hover:shadow-[0_15px_40px_rgba(201,168,76,0.25)] transition-all mt-4" disabled={intentLoading || items.length === 0}>
                  {intentLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Initializing...</> : "Proceed to Payment"}
                </Button>
              </form>
            </div>
          ) : (
            <div className="bg-[#111111] p-6 sm:p-8 md:p-10 border border-primary/10 rounded-sm">
              <div className="flex items-center justify-between mb-8 border-b border-primary/10 pb-4">
                <h2 className="text-lg sm:text-xl font-bold tracking-[0.1em] font-serif text-primary uppercase">Secure Payment</h2>
                <button type="button" onClick={() => setStep("address")} className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground hover:text-primary transition-colors font-bold">← Back</button>
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#888888] mb-8 bg-black/30 p-4 border-l-2 border-primary/40 uppercase tracking-[0.1em] break-words">
                Shipping to: <span className="text-[#F5F5F5] font-bold">{line1}, {city}</span>
              </div>
              {clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret, appearance: stripeAppearance }}>
                  <StripePaymentForm name={name} address={JSON.stringify({ line1, city, state, pincode, phone, name })} phone={phone} total={getTotal()} userId={user.uid} userEmail={user.email!} onSuccess={handleOrderSuccess} />
                </Elements>
              )}
            </div>
          )}
        </div>

        {/* Order review column */}
        <div className="lg:col-span-1 order-1 lg:order-2" data-aos="fade-left" data-aos-delay="200">
          <div className="bg-[#111111] p-6 sm:p-10 rounded-sm border border-primary/10 h-fit shadow-2xl shadow-black lg:sticky lg:top-32">
            <h2 className="text-lg sm:text-xl font-bold mb-6 sm:mb-8 border-b border-primary/10 pb-4 tracking-[0.1em] font-serif text-[#F5F5F5] uppercase">Order Review</h2>
            <div className="space-y-6 mb-8 sm:mb-10 max-h-[300px] sm:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {items.map((item) => (
                <div key={`${item.productId}-${item.color || 'default'}`} className="flex justify-between items-start text-xs sm:text-sm group gap-4">
                  <div className="flex flex-col">
                    <span className="text-[#F5F5F5] font-serif tracking-wide group-hover:text-primary transition-colors">{item.quantity}× {item.name}</span>
                    {item.color && <span className="text-[9px] uppercase tracking-[0.2em] text-primary font-bold mt-1">{item.color}</span>}
                  </div>
                  <span className="font-bold text-[#F5F5F5] tracking-wider whitespace-nowrap">₹{(item.price * item.quantity).toLocaleString("en-IN")}</span>
                </div>
              ))}
            </div>
            <div className="space-y-4 pt-6 border-t border-primary/10">
              <div className="flex justify-between text-[10px] sm:text-xs">
                <span className="text-[#888888] uppercase tracking-[0.1em]">Packaging & Logistics</span>
                <span className="text-primary font-bold tracking-widest uppercase text-[9px] sm:text-[10px]">Complimentary</span>
              </div>
              <div className="flex justify-between mt-6 sm:mt-8">
                <span className="font-bold text-base sm:text-lg tracking-[0.2em] text-[#F5F5F5] uppercase font-serif">Total</span>
                <span className="font-bold text-xl sm:text-2xl text-primary tracking-tighter">₹{getTotal().toLocaleString("en-IN")}</span>
              </div>
            </div>
            <div className="mt-8 sm:mt-10 p-4 border border-primary/5 bg-black/20 rounded-sm">
              <p className="text-[9px] leading-relaxed text-muted-foreground uppercase tracking-[0.1em] text-center">All transactions are encrypted and secured. By proceeding, you agree to our premium terms of service.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
