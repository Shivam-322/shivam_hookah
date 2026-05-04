"use client";

import { useEffect, useState, Suspense } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import ProductCard, { Product } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";

const CATEGORIES = ["Hookah", "Flavors", "Accessories"];

function CatalogContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const categoryFilter = searchParams.get("category");

  useEffect(() => {
    if (categoryFilter) setActiveCategory(categoryFilter);
  }, [categoryFilter]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        const productsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[];
        setProducts(productsData);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  const filteredProducts = products.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory
      ? p.category.toLowerCase() === activeCategory.toLowerCase()
      : true;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="luxury-container section-padding min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start mb-8 sm:mb-12" data-aos="fade-up" suppressHydrationWarning>
        <span className="section-label">Our Collection</span>
        <div className="section-label-hr"></div>
        <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-[0.05em] text-[#F5F5F5] font-serif mt-2 sm:mt-4 break-words w-full">
          The {activeCategory ? activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1).toLowerCase() : "Collection"}
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mb-8 sm:mb-12 items-start lg:items-center justify-between" data-aos="fade-up" data-aos-delay="100" suppressHydrationWarning>
        <div className="relative w-full lg:max-w-md group">
          <Input
            placeholder="Search flavors, hookahs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#111111] border-primary/20 focus-visible:border-primary/60 h-11 rounded-sm pl-4 transition-all"
          />
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center w-full lg:w-auto">
          <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Filter:</span>
          <div className="flex gap-2 flex-wrap items-center w-full sm:w-auto">
            <button
              onClick={() => setActiveCategory(null)}
              className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-sm text-[10px] font-bold tracking-[0.15em] uppercase border transition-all ${
                activeCategory === null
                  ? "border-primary text-black bg-primary"
                  : "border-primary/20 text-muted-foreground hover:border-primary/60"
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat.toLowerCase())}
                className={`flex-1 sm:flex-none px-3 sm:px-4 py-2 rounded-sm text-[10px] font-bold tracking-[0.15em] uppercase border transition-all ${
                  activeCategory?.toLowerCase() === cat.toLowerCase()
                    ? "border-primary text-black bg-primary"
                    : "border-primary/20 text-muted-foreground hover:border-primary/60"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="aspect-square bg-[#111111] animate-pulse rounded-sm border border-primary/5" />
          ))}
        </div>
      ) : filteredProducts.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {filteredProducts.map((product, idx) => (
            <div key={product.id} data-aos="fade-up" data-aos-delay={idx % 4 * 100} suppressHydrationWarning>
              <ProductCard product={product} priority={idx === 0} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <p className="text-lg font-serif">No products found.</p>
        </div>
      )}
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense fallback={<div className="luxury-container section-padding text-center font-serif">Loading...</div>}>
      <CatalogContent />
    </Suspense>
  );
}
