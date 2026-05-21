"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import { getIdToken } from "firebase/auth";
import { Product } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "products"));
      const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
      setProducts(productsData);
    } catch (error) {
      toast.error("Failed to fetch products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this product?")) return;
    try {
      const productToDelete = products.find(p => p.id === id);

      await deleteDoc(doc(db, "products", id));
      
      if (productToDelete?.imageFileId) {
        const currentUser = auth.currentUser;
        if (currentUser) {
          const idToken = await getIdToken(currentUser);
          await fetch("/api/delete-image", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ fileId: productToDelete.imageFileId }),
          });
        }
      }

      toast.success("Product deleted successfully");
      setProducts(products.filter(p => p.id !== id));
    } catch (error) {
      toast.error("Failed to delete product");
    }
  };

  const handleToggleStock = async (id: string, currentStock: number) => {
    const newStock = currentStock > 0 ? 0 : 100;
    try {
      await updateDoc(doc(db, "products", id), { stock: newStock });
      setProducts(products.map(p => p.id === id ? { ...p, stock: newStock } : p));
      toast.success(`Stock updated to ${newStock > 0 ? "Stocked (100)" : "Empty (0)"}`);
    } catch (error) {
      toast.error("Failed to update stock");
    }
  };

  if (loading) return <div className="text-muted-foreground animate-pulse">Loading products...</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-8 tracking-widest text-primary">MANAGE PRODUCTS</h1>
      <div className="rounded-md border border-border/50 overflow-hidden bg-background">
        <Table>
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead>Image</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">No products found.</TableCell>
              </TableRow>
            ) : (
              products.map((product) => (
                <TableRow key={product.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="relative w-12 h-12 rounded overflow-hidden bg-muted">
                      <Image src={product.imageUrl || "/placeholder.svg"} alt={product.name} fill sizes="10vw" className="object-cover" />
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-white">{product.name}</TableCell>
                  <TableCell className="capitalize text-muted-foreground">{product.category}</TableCell>
                  <TableCell className="font-bold text-primary">₹{product.price.toLocaleString("en-IN")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className={`inline-block min-w-[90px] font-bold ${product.stock > 0 ? "text-green-500" : "text-destructive"}`}>
                        {product.stock > 0 ? `Stocked (${product.stock})` : "Empty (0)"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleToggleStock(product.id, product.stock)}
                        className="h-8 px-3 text-[10px] uppercase tracking-wider font-bold border-primary/20 hover:border-primary hover:bg-primary/10 transition-colors"
                      >
                        {product.stock > 0 ? "Set Empty" : "Set Stocked"}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/20" onClick={() => handleDelete(product.id)}>
                      <Trash2 className="h-5 w-5" />
                    </Button>
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
