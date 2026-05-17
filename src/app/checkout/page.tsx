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
import { AnimatePresence, motion } from "framer-motion";

export default function CheckoutPage() {
  const { user, loading: authLoading } = useAuth();
  const { items, clearCart, getTotal } = useCartStore();
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"online" | "upi">("online");

  // UPI-specific states
  const [upiOrderPlaced, setUpiOrderPlaced] = useState(false);
  const [upiOrderId, setUpiOrderId] = useState<string | null>(null);
  const [isUpiLoading, setIsUpiLoading] = useState(false);
  const [upiTotal, setUpiTotal] = useState(0);

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

  const validateForm = (): boolean => {
    const required = ['name', 'phone', 'line1', 'city', 'state', 'pincode'];
    for (const field of required) {
      if (!shippingAddress[field as keyof typeof shippingAddress]?.trim()) {
        toast.error(`Please enter your ${field === 'line1' ? 'address' : field}`);
        return false;
      }
    }
    if (!/^[6-9]\d{9}$/.test(shippingAddress.phone)) {
      toast.error('Please enter a valid 10-digit phone number');
      return false;
    }
    if (!/^\d{6}$/.test(shippingAddress.pincode)) {
      toast.error('Please enter a valid 6-digit pincode');
      return false;
    }
    if (shippingAddress.line1.trim().length < 10) {
      toast.error('Please enter a complete address (at least 10 characters)');
      return false;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return false;
    }
    return true;
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please login to continue');
      router.push('/login');
      return;
    }

    // If UPI is selected, handle UPI order instead
    if (paymentMethod === 'upi') {
      handleUpiOrder();
      return;
    }

    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const token = await user.getIdToken();

      const res = await fetch('/api/phonepe/initiate', {
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

      const data = await res.json();

      if (!res.ok || !data.redirectUrl) {
        toast.error(data.error || 'Failed to initiate payment');
        setIsLoading(false);
        return;
      }

      localStorage.setItem('cart_backup', JSON.stringify(items));
      setIsRedirecting(true);
      toast.loading('Redirecting to PhonePe...', { id: 'phonepe-redirect' });
      window.location.href = data.redirectUrl;

    } catch (err) {
      setIsLoading(false);
      setIsRedirecting(false);
      toast.error('Something went wrong. Please try again.');
    }
  };

  const handleUpiOrder = async () => {
    if (!user) {
      toast.error('Please login to continue');
      return;
    }
    if (!validateForm()) return;

    setIsUpiLoading(true);

    try {
      const token = await user.getIdToken();

      const res = await fetch('/api/upi/place-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
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

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to place order');
      }

      const data = await res.json();

      setUpiOrderId(data.orderId);
      setUpiTotal(getTotal());
      clearCart();
      setUpiOrderPlaced(true);

    } catch (error: any) {
      toast.error(error.message || 'Failed to place order. Please try again.');
    } finally {
      setIsUpiLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="animate-spin h-12 w-12 text-primary" />
      </div>
    );
  }

  // Show redirecting overlay when navigating to PhonePe
  if (isRedirecting) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0A0A0A] gap-6">
        <Loader2 className="animate-spin h-16 w-16 text-primary" />
        <div className="text-center space-y-3">
          <h2 className="text-xl sm:text-2xl font-bold text-[#F5F5F5] tracking-[0.1em] font-serif uppercase">
            Redirecting to PhonePe
          </h2>
          <p className="text-sm text-muted-foreground tracking-wider uppercase">
            Please wait while we connect you to the payment page...
          </p>
        </div>
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
        <span className="section-label">Safe &amp; Secure</span>
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
              
              <div className="mt-8">
                {/* Payment Method Selector */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("online")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === "online"
                        ? "border-purple-500 bg-purple-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <span className="text-2xl mb-1">💳</span>
                    <span className="text-sm font-medium text-gray-800">Pay Online</span>
                    <span className="text-xs text-gray-500 mt-1">Cards, UPI, NetBanking</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("upi")}
                    className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all ${
                      paymentMethod === "upi"
                        ? "border-green-500 bg-green-50"
                        : "border-gray-200 bg-white"
                    }`}
                  >
                    <span className="text-2xl mb-1">📱</span>
                    <span className="text-sm font-medium text-gray-800">Pay via UPI</span>
                    <span className="text-xs text-gray-500 mt-1">GPay, PhonePe, Paytm</span>
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {paymentMethod === "online" ? (
                    <motion.div
                      key="online-panel"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Button type="submit" className="w-full font-bold text-[11px] sm:text-[12px] tracking-[0.2em] h-14 sm:h-16 uppercase shadow-[0_10px_30px_rgba(201,168,76,0.15)] hover:shadow-[0_15px_40px_rgba(201,168,76,0.25)] transition-all mt-4" disabled={isLoading || items.length === 0}>
                        {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : `Pay ₹${getTotal().toLocaleString("en-IN")}`}
                      </Button>
                      <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center uppercase tracking-[0.1em] mt-4">
                        🔒 Secure Encrypted Transaction — Powered by PhonePe
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="upi-panel"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                    >
                      {/* UPI Thank You Message — shown after order is placed */}
                      {upiOrderPlaced ? (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="bg-green-50 border border-green-200 rounded-2xl p-8 text-center space-y-5"
                        >
                          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                            <span className="text-3xl">🎉</span>
                          </div>

                          <div>
                            <h3 className="text-xl font-bold text-gray-800">
                              Order Placed Successfully!
                            </h3>
                          </div>

                          <div className="bg-white border-2 border-green-200 rounded-xl p-4 space-y-2">
                            <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">
                              Your Order ID
                            </p>
                            <p className="text-lg font-bold font-mono text-gray-800 break-all">
                              {upiOrderId}
                            </p>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(upiOrderId ?? "");
                                  toast.success("Order ID copied!");
                                }}
                                className="flex items-center gap-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-1.5 rounded-lg transition-colors font-medium"
                              >
                                📋 Copy Order ID
                              </button>
                              <p className="text-xs text-gray-400">
                                Save this for your records
                              </p>
                            </div>
                          </div>

                          <p className="text-xs text-gray-400 text-center">
                            📧 This Order ID has also been sent to your email
                          </p>

                          <div className="space-y-3 text-left">
                            <div className="bg-white rounded-xl p-4 border border-green-100">
                              <p className="text-sm font-medium text-gray-700">
                                📧 Confirmation email sent to:
                              </p>
                              <p className="text-sm text-green-600 font-medium mt-1">
                                {user.email}
                              </p>
                            </div>

                            <div className="bg-yellow-50 rounded-xl p-4 border border-yellow-200">
                              <p className="text-sm font-medium text-yellow-800">
                                ⚠️ Important — Last step!
                              </p>
                              <p className="text-sm text-yellow-700 mt-1">
                                Please send your payment screenshot on WhatsApp to confirm your order.
                                We will verify and confirm within 2 hours.
                              </p>
                            </div>
                          </div>

                          <a
                            href={`https://wa.me/918922942213?text=${encodeURIComponent(
                              `Hi! I have paid for my order.\n\nOrder ID: ${upiOrderId}\nAmount Paid: ₹${upiTotal.toLocaleString("en-IN")}\n\nPlease confirm my order.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3 w-full bg-[#25D366] hover:bg-[#20BD5C] text-white font-semibold py-4 px-6 rounded-xl transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            Send Payment Screenshot on WhatsApp
                          </a>

                          <button
                            onClick={() => router.push("/catalog")}
                            className="text-sm text-gray-500 hover:text-gray-700 underline transition-colors"
                          >
                            Continue Shopping
                          </button>
                        </motion.div>
                      ) : (
                        /* UPI Payment Panel — shown before order is placed */
                        <>
                          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 space-y-5">
                          <div className="text-center">
                            <h3 className="text-lg font-semibold text-gray-800">
                              Complete Your Payment
                            </h3>
                            <p className="text-sm text-gray-500 mt-1">
                              Pay the exact amount to confirm your order
                            </p>
                          </div>

                          <div className="bg-white rounded-xl p-4 text-center border border-green-100">
                            <p className="text-sm text-gray-500">Amount to Pay</p>
                            <p className="text-3xl font-bold text-green-600 mt-1">
                              ₹{getTotal().toLocaleString("en-IN")}
                            </p>
                          </div>

                          <div className="flex flex-col items-center space-y-3">
                            <p className="text-sm font-medium text-gray-600">Scan QR Code to Pay</p>
                            <div className="bg-white p-3 rounded-xl border border-green-100 shadow-sm">
                              <Image
                                src="/images/upi-qr.jpeg"
                                alt="UPI QR Code"
                                width={180}
                                height={180}
                                className="rounded-lg"
                              />
                            </div>
                            <p className="text-xs text-gray-400">
                              Works with GPay, PhonePe, Paytm, BHIM &amp; all UPI apps
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="flex-1 h-px bg-green-200"/>
                            <span className="text-xs text-gray-400">OR</span>
                            <div className="flex-1 h-px bg-green-200"/>
                          </div>

                          <div className="bg-white rounded-xl p-4 border border-green-100">
                            <p className="text-xs text-gray-500 mb-2">Pay directly to UPI ID</p>
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-base font-mono font-semibold text-gray-800">
                                paytmqr6p6x8r@ptys
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText("paytmqr6p6x8r@ptys");
                                  toast.success("UPI ID copied!");
                                }}
                                className="text-xs bg-green-100 text-green-700 px-3 py-1.5 rounded-lg font-medium hover:bg-green-200 transition-colors flex-shrink-0"
                              >
                                Copy
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <p className="text-sm font-medium text-gray-700">How to pay:</p>
                            {[
                              "Open any UPI app (GPay, PhonePe, Paytm)",
                              "Scan the QR code or enter our UPI ID",
                              `Pay exactly ₹${getTotal().toLocaleString("en-IN")}`,
                              'Click "I Have Paid" below',
                              "Send payment screenshot on WhatsApp",
                            ].map((step, i) => (
                              <div key={i} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-5 h-5 bg-green-500 text-white rounded-full text-xs flex items-center justify-center font-bold mt-0.5">
                                  {i + 1}
                                </span>
                                <p className="text-sm text-gray-600">{step}</p>
                              </div>
                            ))}
                          </div>

                          <a
                            href={`https://wa.me/918922942213?text=${encodeURIComponent(
                              `Hi! I want to place an order.\n\n` +
                              `🛍️ Order Details:\n` +
                              `${items.map(item =>
                                `• ${item.name} x${item.quantity} — ` +
                                `₹${(item.price * item.quantity).toLocaleString("en-IN")}`
                              ).join("\n")}\n\n` +
                              `💰 Total Amount: ₹${getTotal().toLocaleString("en-IN")}\n\n` +
                              `📦 Shipping to:\n` +
                              `${shippingAddress?.name}\n` +
                              `${shippingAddress?.line1}, ` +
                              `${shippingAddress?.city}\n` +
                              `${shippingAddress?.state} — ` +
                              `${shippingAddress?.pincode}\n` +
                              `📱 Phone: ${shippingAddress?.phone}\n\n` +
                              `I have made the UPI payment. ` +
                              `Please find my payment ` +
                              `screenshot attached.`
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-3 w-full bg-[#25D366] hover:bg-[#20BD5C] text-white font-semibold py-4 px-6 rounded-xl transition-colors"
                          >
                            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current flex-shrink-0">
                              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                            </svg>
                            📸 Send Payment Screenshot on WhatsApp
                          </a>

                          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                            <p className="text-xs text-yellow-800 text-center">
                              ⚠️ Your order will be confirmed only after we verify your payment. Please send the screenshot immediately after paying.
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleUpiOrder}
                          disabled={isUpiLoading || items.length === 0}
                          className="w-full flex items-center justify-center gap-3 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-white font-bold text-lg py-4 px-6 rounded-xl transition-all duration-200 shadow-lg shadow-yellow-200 mt-4"
                        >
                          {isUpiLoading ? (
                            <>
                              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                              </svg>
                              Placing Order...
                            </>
                          ) : (
                            <>
                              ✅ I Have Paid — Place My Order
                            </>
                          )}
                        </button>
                      </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                <span className="text-[#888888] uppercase tracking-[0.1em]">Packaging &amp; Logistics</span>
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
