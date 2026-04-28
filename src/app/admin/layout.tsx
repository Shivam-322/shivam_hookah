"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { Loader2, Package, ShoppingBag, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push("/");
    }
  }, [user, isAdmin, loading, router]);

  if (loading || !isAdmin) {
    return <div className="min-h-[calc(100vh-200px)] flex items-center justify-center"><Loader2 className="animate-spin h-12 w-12 text-primary" /></div>;
  }

  return (
    <div className="container mx-auto px-4 py-12 flex flex-col md:flex-row gap-8 min-h-[calc(100vh-200px)]">
      <aside className="w-full md:w-64 flex-shrink-0">
        <div className="sticky top-24 bg-card border border-border/50 rounded-lg p-4 space-y-2 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
          <h2 className="font-bold text-xl mb-4 px-2 tracking-widest text-primary">ADMIN</h2>
          <Link href="/admin">
            <Button variant="ghost" className="w-full justify-start text-lg h-12 hover:bg-primary/10 hover:text-primary">
              <Package className="mr-3 h-5 w-5" /> Products
            </Button>
          </Link>
          <Link href="/admin/add-product">
            <Button variant="ghost" className="w-full justify-start text-lg h-12 hover:bg-primary/10 hover:text-primary">
              <PlusCircle className="mr-3 h-5 w-5" /> Add Product
            </Button>
          </Link>
          <Link href="/admin/orders">
            <Button variant="ghost" className="w-full justify-start text-lg h-12 hover:bg-primary/10 hover:text-primary">
              <ShoppingBag className="mr-3 h-5 w-5" /> Orders
            </Button>
          </Link>
        </div>
      </aside>
      <main className="flex-1 bg-card border border-border/50 rounded-lg p-6 md:p-8 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
        {children}
      </main>
    </div>
  );
}
