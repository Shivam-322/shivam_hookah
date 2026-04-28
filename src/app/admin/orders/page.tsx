"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export default function AdminOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    try {
      const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
      const querySnapshot = await getDocs(q);
      const ordersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setOrders(ordersData);
    } catch (error) {
      toast.error("Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "orders", id), { status: newStatus });
      toast.success("Order status updated");
      setOrders(orders.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case "confirmed": return "bg-blue-500 hover:bg-blue-600 text-white";
      case "shipped": return "bg-orange-500 hover:bg-orange-600 text-white";
      case "delivered": return "bg-green-500 hover:bg-green-600 text-white";
      default: return "bg-gray-500 text-white";
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
                <TableRow 
                  key={order.id} 
                  className="hover:bg-white/5 cursor-pointer transition-colors border-b border-border/20 group"
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                >
                  <TableCell className="font-medium text-amber-500 group-hover:text-amber-400 transition-colors">#{order.id}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-white text-sm">{order.userEmail}</span>
                      <span className="text-[10px] text-muted-foreground mt-1 line-clamp-1 max-w-[200px] uppercase tracking-tighter" title={typeof order.shippingAddress === 'string' ? order.shippingAddress : `${order.shippingAddress?.line1 || ''}, ${order.shippingAddress?.city || ''}`}>
                        {typeof order.shippingAddress === 'string' ? order.shippingAddress : `${order.shippingAddress?.line1 || ''}, ${order.shippingAddress?.city || ''}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-white">₹{order.total.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`${getStatusColor(order.status)} border-none text-[9px] px-2 py-0.5 font-bold tracking-widest`}>
                      {order.status.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <select 
                      className="bg-black border border-border/50 rounded-sm px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-amber-500/50 cursor-pointer text-white uppercase tracking-wider font-bold"
                      value={order.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleStatusChange(order.id, e.target.value);
                      }}
                    >
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
