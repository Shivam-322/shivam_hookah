"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft, Mail, Phone, MapPin, Package, Calendar, CreditCard, Clock } from "lucide-react";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import { toast } from "sonner";
import Image from "next/image";
import { useAuth } from "@/context/AuthContext";
import type { Order } from "@/types/index";

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const docRef = doc(db, "orders", orderId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setOrder({ id: docSnap.id, ...docSnap.data() } as Order);
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
      setOrder({ ...order!, status: newStatus as Order['status'] });
      toast.success(`Order marked as ${newStatus}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdating(false);
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
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <button onClick={() => router.push("/admin/orders")} className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors mb-4">
              <ArrowLeft className="h-3 w-3" /> Back to Dashboard
            </button>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl sm:text-4xl font-serif font-bold tracking-tight">
                Order <span className="text-amber-500">#{order.id?.slice(0, 8)}</span>
              </h1>
              <OrderStatusBadge
                status={order.status}
                shippingStatus={order.shiprocket?.status || undefined}
                shippingStatusLabel={order.shiprocket?.statusLabel || undefined}
                awb={order.shiprocket?.awb || undefined}
                courierName={order.shiprocket?.courierName || undefined}
              />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
              {order.shiprocket?.lastUpdated && (
                <p className="text-[10px] text-muted-foreground flex items-center gap-2 uppercase tracking-widest font-bold">
                  <Clock className="h-3 w-3" />
                  Updated: {new Date(order.shiprocket.lastUpdated).toLocaleString('en-IN')}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <select className="bg-[#111111] border border-white/10 rounded-sm px-4 py-2 text-xs font-bold uppercase tracking-widest outline-none focus:border-primary transition-all cursor-pointer" value={order.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={updating}>
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
                      <Image src={item.imageUrl || "/placeholder.svg"} alt={item.name} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="flex-grow">
                      <h3 className="text-base font-serif font-bold text-white">{item.name}</h3>
                      <p className="text-[10px] uppercase tracking-widest text-amber-500 font-bold mt-1">Finish: {item.color || "Standard"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">₹{item.price?.toLocaleString("en-IN")}</p>
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
                    <p className="text-[11px] text-white font-mono break-all">{order.payment?.razorpayPaymentId || "N/A"}</p>
                    {order.payment?.razorpayPaymentId && (
                      <a href={`https://dashboard.razorpay.com/app/payments/${order.payment.razorpayPaymentId}`} target="_blank" rel="noopener noreferrer" className="text-[9px] uppercase tracking-widest text-blue-400 hover:underline mt-2 inline-block">
                        View in Razorpay Dashboard →
                      </a>
                    )}
                  </div>
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs text-muted-foreground uppercase tracking-widest">Subtotal</span>
                      <span className="text-sm font-bold">₹{order.total?.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-xs text-muted-foreground uppercase tracking-widest">Logistics</span>
                      <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">Complimentary</span>
                    </div>
                    <div className="flex justify-between items-center pt-4 border-t border-white/10">
                      <span className="text-sm font-serif font-bold uppercase tracking-widest">Total</span>
                      <span className="text-xl font-bold text-amber-500">₹{order.total?.toLocaleString("en-IN")}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Shiprocket Shipment Info Card */}
            <div className="bg-[#111111] border border-white/5 rounded-sm p-6 space-y-6 glass-morphism mt-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-[0.2em] mb-4 flex items-center gap-2 border-b border-white/5 pb-4">
                🚚 Shipment Details
              </h3>

              {order.shiprocket?.orderId && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Shiprocket Order ID</span>
                    <span className="text-sm font-mono text-white">{order.shiprocket.orderId}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Courier Partner</span>
                    <span className="text-sm font-medium text-white">{order.shiprocket.courierName || 'Assigning...'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">AWB / Tracking No.</span>
                    <span className="text-sm font-mono font-medium text-white">{order.shiprocket.awb || 'Generating...'}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Shipping Status</span>
                    <span className="text-sm font-medium capitalize text-amber-500">
                      {order.shiprocket.statusLabel || order.shiprocket.status?.replace(/_/g, ' ') || 'Shipment Created'}
                    </span>
                  </div>
                  {order.shiprocket?.etd && (
                    <div className="flex justify-between py-2 border-b border-white/10">
                      <span className="text-gray-400 text-sm">Est. Delivery</span>
                      <span className="text-white">
                        {new Date(order.shiprocket.etd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  )}
                  {order.shiprocket.labelUrl && (
                    <a href={order.shiprocket.labelUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 w-full mt-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-sm px-4 py-3 transition-all text-xs uppercase tracking-widest font-bold">
                      🖨️ Print Shipping Label
                    </a>
                  )}
                </div>
              )}

              {order.shiprocket?.status === 'shiprocket_failed' && (
                <div className="border border-red-500/30 rounded-sm p-4 bg-red-500/10">
                  <p className="text-xs uppercase tracking-widest text-red-400 font-bold mb-2">⚠️ Shiprocket Shipment Failed</p>
                  <p className="text-[11px] text-muted-foreground mb-4">{order.shiprocket.error || 'Unknown error occurred'}</p>
                  <button
                    onClick={async () => {
                      toast.loading('Retrying Shiprocket...', { id: 'retry' });
                      try {
                        const token = await user!.getIdToken();
                        const res = await fetch('/api/admin/retry-shipment', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ orderId: order.id }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          toast.success(`Retry successful! AWB: ${data.awb}`, { id: 'retry' });
                          setOrder({
                            ...order,
                            shiprocket: {
                              ...order.shiprocket,
                              orderId: data.shiprocketOrderId || order.shiprocket.orderId,
                              shipmentId: data.shipmentId || order.shiprocket.shipmentId,
                              awb: data.awb || order.shiprocket.awb,
                              courierName: data.courierName || order.shiprocket.courierName,
                              labelUrl: data.labelUrl || order.shiprocket.labelUrl,
                              status: 'shipment_created',
                              error: null,
                            },
                          });
                        } else {
                          toast.error(data.error, { id: 'retry' });
                        }
                      } catch {
                        toast.error('Retry failed', { id: 'retry' });
                      }
                    }}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 rounded-sm px-4 py-3 transition-all text-xs uppercase tracking-widest font-bold w-full"
                  >
                    🔄 Retry Shipment Creation
                  </button>
                </div>
              )}

              {!order.shiprocket?.orderId && order.shiprocket?.status !== 'shiprocket_failed' && (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <div className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs uppercase tracking-widest font-bold">Creating shipment on Shiprocket...</span>
                </div>
              )}
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
                  <a href={`mailto:${order.userEmail}`} className="flex items-center gap-3 text-xs text-muted-foreground hover:text-white transition-colors">
                    <Mail className="h-3 w-3" /> {order.userEmail}
                  </a>
                  {order.shippingAddress?.phone && (
                    <a href={`tel:${order.shippingAddress.phone}`} className="flex items-center gap-3 text-xs text-muted-foreground hover:text-white transition-colors">
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
