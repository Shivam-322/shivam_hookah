"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, doc, updateDoc, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Order } from "@/types/index";
import OrderStatusBadge from "@/components/admin/OrderStatusBadge";
import { useAuth } from "@/context/AuthContext";

export default function AdminOrdersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Order[];
      setOrders(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching orders:", error);
      toast.error("Failed to fetch orders");
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", orderId), { status: newStatus });
      if (user) {
        const token = await user.getIdToken();
        fetch('/api/admin/update-sheet-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ orderId, status: newStatus }),
        }).catch(() => {});
      }
      toast.success("Order status updated");
    } catch {
      toast.error("Failed to update status");
    }
  };

  if (loading) return <div className="text-muted-foreground animate-pulse p-8">Loading orders...</div>;

  return (
    <div className="p-4 sm:p-8">
      <h1 className="text-2xl font-bold mb-8 tracking-widest text-primary uppercase">Manage Orders</h1>
      <div className="rounded-sm border border-border/50 overflow-hidden bg-[#111111]">
        <Table>
          <TableHeader className="bg-black/40">
            <TableRow className="hover:bg-transparent border-b border-border/50">
              <TableHead className="text-[10px] uppercase tracking-widest font-bold">Order ID</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest font-bold">Date</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest font-bold">Customer</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest font-bold">Total</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest font-bold">Status</TableHead>
              <TableHead className="text-[10px] uppercase tracking-widest font-bold">Update</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No orders found.</TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-white/5 cursor-pointer transition-colors border-b border-border/20 group" onClick={() => router.push(`/admin/orders/${order.id}`)}>
                  <TableCell className="font-medium text-amber-500 group-hover:text-amber-400 transition-colors">#{order.id}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-white text-sm">{order.userEmail}</span>
                      <span className="text-[10px] text-muted-foreground mt-1 line-clamp-1 max-w-[200px] uppercase tracking-tighter" title={`${order.shippingAddress?.line1 || ''}, ${order.shippingAddress?.city || ''}`}>
                        {`${order.shippingAddress?.line1 || ''}, ${order.shippingAddress?.city || ''}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-white">₹{order.total?.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <OrderStatusBadge
                      status={order.status}
                      shippingStatus={order.shiprocket?.status || undefined}
                      shippingStatusLabel={order.shiprocket?.statusLabel || undefined}
                      awb={order.shiprocket?.awb || undefined}
                      courierName={order.shiprocket?.courierName || undefined}
                    />
                    <div className="mt-1 space-y-0.5">
                      {order.shiprocket?.awb && (
                        <p className="text-xs text-gray-400 font-mono mt-1">📦 {order.shiprocket.courierName} · {order.shiprocket.awb}</p>
                      )}
                      {order.shiprocket?.status === 'shiprocket_failed' && (
                        <p className="text-xs text-red-400 mt-1">⚠️ Shiprocket failed</p>
                      )}
                      {!order.shiprocket?.orderId && order.shiprocket?.status !== 'shiprocket_failed' && order.status === 'confirmed' && (
                        <p className="text-xs text-yellow-400 mt-1">⏳ Creating shipment...</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <select className="bg-black border border-border/50 rounded-sm px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-amber-500/50 cursor-pointer text-white uppercase tracking-wider font-bold" value={order.status} onClick={(e) => e.stopPropagation()} onChange={(e) => { e.stopPropagation(); handleStatusChange(order.id!, e.target.value); }}>
                      <option value="confirmed">Confirmed</option>
                      <option value="shipped">Shipped</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
