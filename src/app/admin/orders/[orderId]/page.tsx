"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Mail, Phone, MapPin, Package, Calendar, CreditCard } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const docRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() });
        } else {
          toast.error("Order not found");
          router.push("/admin/orders");
        }
      } catch (error) {
        console.error("Error fetching order:", error);
        toast.error("Failed to load order details");
      } finally {
        setLoading(false);
      }
    };

    if (orderId) fetchOrder();
  }, [orderId, router]);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
      setOrder({ ...order, status: newStatus });
      toast.success(`Order marked as ${newStatus}`);
    } catch (error) {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-blue-500/20 text-blue-400 border-blue-500/50";
      case "shipped": return "bg-orange-500/20 text-orange-400 border-orange-500/50";
      case "delivered": return "bg-green-500/20 text-green-400 border-green-500/50";
      default: return "bg-gray-500/20 text-gray-400 border-gray-500/50";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0A0A0A]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) return null;

  return (
    <div className="min-h-screen bg-[#0A0A0A] p-4 sm:p-8 lg:p-12 font-sans text-white">
      {/* Navigation & Header */}
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <button
              onClick={() => router.push("/admin/orders")}
              className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-4"
            >
              <ArrowLeft className="h-3 w-3" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight">
                Order <span className="text-amber-500">#{order.id.slice(0, 8)}</span>
              </h1>
              <Badge variant="outline" className={`${getStatusColor(order.status)} uppercase tracking-widest px-3 py-1 text-[10px] font-bold`}>
                {order.status}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              className="bg-[#111111] border border-white/10 rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary transition-all cursor-pointer"
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              disabled={updating}
            >
              <option value="confirmed">Mark Confirmed</option>
              <option value="shipped">Mark Shipped</option>
              <option value="delivered">Mark Delivered</option>
            </select>
            <Button variant="outline" className="border-white/10 text-xs uppercase tracking-widest h-10 hover:bg-white/5">
              Print Invoice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Items Card */}
            <div className="bg-[#111111] border border-white/5 rounded-sm overflow-hidden glass-morphism">
              <div className="p-6 border-b border-white/5 flex items-center gap-3">
                <Package className="h-5 w-5 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-serif">Order Items</h2>
              </div>
              <div className="divide-y divide-white/5">
                {order.items?.map((item: any, idx: number) => (
                  <div key={`${item.productId}-${idx}`} className="p-6 flex items-center gap-6 group">
                    <div className="relative h-20 w-20 flex-shrink-0 bg-black rounded-sm border border-white/5 overflow-hidden">
                      <Image
                        src={item.imageUrl || "/placeholder.svg"}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-base font-serif font-bold text-white">{item.name}</h3>
                      <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mt-1">
                        Finish: {item.color || "Standard"}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">₹{item.price.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Shipping & Payment Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="bg-[#111111] border border-white/5 rounded-sm p-6 space-y-6 glass-morphism">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <MapPin className="h-5 w-5 text-amber-500" />
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-serif">Delivery</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Recipient</p>
                    <p className="text-sm text-white font-medium">{order.shippingAddress?.name || order.userName}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Address</p>
                    <p className="text-sm text-white leading-relaxed">
                      {order.shippingAddress?.line1}<br />
                      {order.shippingAddress?.city}, {order.shippingAddress?.state}<br />
                      {order.shippingAddress?.pincode}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-[#111111] border border-white/5 rounded-sm p-6 space-y-6 glass-morphism">
                <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                  <CreditCard className="h-5 w-5 text-amber-500" />
                  <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-serif">Payment</h2>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">Transaction ID</p>
                    <p className="text-[11px] text-white font-mono break-all">{order.stripePaymentIntentId || "N/A"}</p>
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-widest">Subtotal</span>
                      <span className="text-sm font-bold">₹{order.total.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-muted-foreground uppercase tracking-widest">Logistics</span>
                      <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Complimentary</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-white/10">
                      <span className="text-sm font-serif font-bold uppercase tracking-widest">Total</span>
                      <span className="text-xl font-bold text-amber-500">₹{order.total.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <div className="bg-[#111111] border border-white/5 rounded-sm p-6 space-y-6 glass-morphism">
              <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                <Mail className="h-5 w-5 text-amber-500" />
                <h2 className="text-sm font-bold uppercase tracking-[0.2em] font-serif">Customer</h2>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-amber-500 font-bold">
                    {order.userEmail?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white truncate max-w-[150px]">{order.userEmail}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Customer ID: {order.userId?.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="pt-4 border-t border-white/5 space-y-3">
                  <a
                    href={`mailto:${order.userEmail}`}
                    className="flex items-center gap-3 text-xs text-muted-foreground hover:text-white transition-colors"
                  >
                    <Mail className="h-3 w-3" /> {order.userEmail}
                  </a>
                  {order.shippingAddress?.phone && (
                    <a
                      href={`tel:${order.shippingAddress.phone}`}
                      className="flex items-center gap-3 text-xs text-muted-foreground hover:text-white transition-colors"
                    >
                      <Phone className="h-3 w-3" /> {order.shippingAddress.phone}
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-sm p-6">
              <h3 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-4">Concierge Note</h3>
              <p className="text-[11px] leading-relaxed text-amber-500/80 uppercase tracking-widest font-medium">
                Please ensure all orders are verified and items are inspected for premium quality before marking as Shipped.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .glass-morphism {
          backdrop-filter: blur(10px);
          background: rgba(17, 17, 17, 0.8);
        }
      `}</style>
    </div>
  );
}
