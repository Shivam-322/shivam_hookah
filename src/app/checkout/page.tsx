'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useCartStore } from '@/store/useCartStore';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import Image from "next/image";

// Load Razorpay script dynamically
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, clearCart, getTotal } = useCartStore();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({
    name: '',
    phone: '',
    line1: '',
    city: '',
    state: '',
    pincode: '',
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/checkout");
    }
  }, [user, authLoading, router]);

  // Pre-fill from user profile if available
  useEffect(() => {
    if (user?.displayName) {
      setShippingAddress(prev => ({ ...prev, name: user.displayName || '' }));
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setShippingAddress((prev) => ({ ...prev, [id]: value }));
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please login to continue');
      router.push('/login');
      return;
    }

    // Validate shipping address
    const required = ['name', 'phone', 'line1', 'city', 'state', 'pincode'];
    for (const field of required) {
      if (!shippingAddress[field as keyof typeof shippingAddress]?.trim()) {
        toast.error(`Please enter your ${field}`);
        return;
      }
    }

    if (items.length === 0) {
      toast.error('Your cart is empty');
      return;
    }

    setIsLoading(true);

    try {
      // Step 1 — Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        toast.error('Failed to load payment gateway. Please try again.');
        setIsLoading(false);
        return;
      }

      // Step 2 — Create Razorpay order on server
      const token = await user.getIdToken();
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            color: item.color || '',
          })),
          shippingAddress,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok) {
        toast.error(orderData.error || 'Failed to initiate payment');
        setIsLoading(false);
        return;
      }

      // Step 3 — Open Razorpay modal
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,           // in paise
        currency: orderData.currency,
        name: 'Shivam Hookah',
        description: 'Premium Hookah Products',
        image: '/logo.png',                 // your logo path
        order_id: orderData.orderId,        // rzp_order_xxx
        
        // All payment methods enabled
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true,
          emi: false,
        },

        prefill: {
          name: shippingAddress.name,
          email: user.email || '',
          contact: shippingAddress.phone,
        },

        theme: {
          color: '#d4af37',   // your gold theme color
        },

        // Payment SUCCESS handler
        handler: async (response: any) => {
          // console.log('[razorpay] Payment successful');
          toast.loading('Confirming your order...', { id: 'confirm' });


          try {
            const freshToken = await user.getIdToken();
            const verifyRes = await fetch('/api/razorpay/verify-payment', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${freshToken}`,
              },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                shippingAddress,
                items: orderData.verifiedItems,
                total: orderData.total,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              toast.error(verifyData.error || 'Order confirmation failed', 
                { id: 'confirm' });
              setIsLoading(false);
              return;
            }

            // Clear cart and redirect to success
            clearCart();
            toast.success('Order placed successfully!', { id: 'confirm' });
            router.push(`/order-success?orderId=${verifyData.orderId}`);

          } catch (err) {
            // console.error('[razorpay] Verification failed');

            toast.error('Payment received but order confirmation failed. Contact support.',
              { id: 'confirm' });
            setIsLoading(false);
          }
        },

        // Payment FAILURE handler  
        modal: {
          ondismiss: () => {
            // console.log('[razorpay] Payment modal dismissed');

            toast.info('Payment cancelled');
            setIsLoading(false);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);

      razorpayInstance.on('payment.failed', (response: any) => {
        // console.error('[razorpay] Payment failed');

        toast.error(`Payment failed: ${response.error.description}`);
        setIsLoading(false);
      });

      razorpayInstance.open();

    } catch (err) {
      // console.error('[razorpay] Checkout error');

      toast.error('Something went wrong. Please try again.');
      setIsLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  return (
    <div className="luxury-container section-padding min-h-screen px-4 sm:px-6 lg:px-8">
      {/* Policy Strip */}
      <div className="w-full bg-red-900/20 border border-red-500/20 rounded-sm p-4 mb-8 text-center" data-aos="fade-down">
        <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-red-500 font-bold">
          ⚠️ Important: No Replacement / Return Policy ⚠️
        </p>
      </div>

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
          <div className="bg-[#111111] p-6 sm:p-8 md:p-10 border border-primary/10 rounded-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-lg sm:text-xl font-bold tracking-[0.1em] font-serif text-primary uppercase mb-6 sm:mb-8 border-b border-primary/10 pb-4">
              Delivery Details
            </h2>
            <form id="address-form" onSubmit={handlePayment} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Full Name</Label>
                  <Input id="name" required value={shippingAddress.name} onChange={handleInputChange} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Phone Number</Label>
                  <Input id="phone" type="tel" required value={shippingAddress.phone} onChange={handleInputChange} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="+91" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Email Address</Label>
                <Input id="email" type="email" required value={user.email || ''} disabled className="bg-black/10 border-primary/10 opacity-50 cursor-not-allowed" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="line1" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Street Address</Label>
                <Input id="line1" required value={shippingAddress.line1} onChange={handleInputChange} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="House No, Street, Area" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="city" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">City</Label>
                  <Input id="city" required value={shippingAddress.city} onChange={handleInputChange} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="City" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">State</Label>
                  <Input id="state" required value={shippingAddress.state} onChange={handleInputChange} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="State" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pincode" className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">Pincode</Label>
                  <Input id="pincode" required value={shippingAddress.pincode} onChange={handleInputChange} className="bg-black/20 border-primary/10 focus-visible:border-primary/50" placeholder="000000" />
                </div>
              </div>
              <Button type="submit" className="w-full font-bold text-[11px] sm:text-[12px] tracking-[0.2em] h-14 sm:h-16 uppercase shadow-[0_10px_30px_rgba(201,168,76,0.15)] hover:shadow-[0_15px_40px_rgba(201,168,76,0.25)] transition-all mt-4" disabled={isLoading || items.length === 0}>
                {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : `Pay ₹${getTotal().toLocaleString("en-IN")}`}
              </Button>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center uppercase tracking-[0.1em]">
                🔒 Secure Encrypted Transaction — Verified by Razorpay
              </p>
            </form>
          </div>
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
