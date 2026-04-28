"use client";

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useCartStore } from "@/store/useCartStore";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Product } from "@/components/ProductCard";
import { notFound, useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ProductDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addItem } = useCartStore();

  useEffect(() => {
    if (!id) return;

    const fetchProduct = async () => {
      try {
        const docRef = doc(db, "products", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
        } else {
          setProduct(null);
        }
      } catch (error) {
        console.error("Error fetching product:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  if (loading) {
    return (
      <div className="luxury-container section-padding flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return notFound();
  }

  const currentVariant = product.variants?.[selectedVariant] || {
    color: product.color,
    images: [{ url: product.imageUrl, fileId: product.imageFileId }]
  };

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: currentVariant.images[selectedImage]?.url || product.imageUrl,
      color: currentVariant.color || product.color,
    });
    toast.success(`${product.name} (${currentVariant.color}) added to your session!`);
  };

  return (
    <div className="luxury-container section-padding min-h-screen bg-[#0A0A0A] px-4 sm:px-6 lg:px-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 sm:gap-16 lg:gap-24 items-start">
        {/* Gallery Section */}
        <div className="space-y-6" data-aos="fade-right">
          {/* Main Image */}
          <div className="relative w-full bg-[#111111] rounded-sm overflow-hidden border border-primary/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-center min-h-[400px] sm:min-h-[500px] lg:min-h-[600px]">
            <Image
              src={currentVariant.images[selectedImage]?.url || product.imageUrl || "/placeholder.svg"}
              alt={product.name}
              width={1000}
              height={1250}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="w-full h-auto max-h-[80vh] object-contain transition-all duration-700 ease-in-out"
              priority
            />
          </div>

          {/* Thumbnails - Horizontal Strip */}
          {currentVariant.images.length > 1 && (
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {currentVariant.images.map((img, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedImage(idx)}
                  className={`relative w-20 sm:w-24 aspect-square flex-shrink-0 rounded-sm overflow-hidden border-2 transition-all ${
                    selectedImage === idx ? "border-primary" : "border-transparent opacity-50 hover:opacity-100"
                  }`}
                >
                  <Image
                    src={img.url}
                    alt={`${product.name} view ${idx + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details Section */}
        <div className="flex flex-col space-y-8 sm:space-y-10" data-aos="fade-left">
          <div>
            <div className="flex flex-col items-start mb-4 sm:mb-6">
              <span className="section-label">{product.category}</span>
              <div className="section-label-hr"></div>
            </div>
            
            <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold tracking-[0.02em] mb-4 sm:mb-6 font-serif text-[#F5F5F5] leading-tight">
              {product.name}
            </h1>
            
            <div className="flex flex-wrap items-baseline gap-3 sm:gap-4">
              <p className="text-2xl sm:text-3xl font-bold text-primary tracking-wider">
                ₹{product.price.toLocaleString("en-IN")}
              </p>
              <span className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-[0.1em]">Inclusive of all taxes</span>
            </div>

            {/* Color Selection */}
            {product.variants && product.variants.length > 0 && (
              <div className="mt-8 space-y-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-bold">Choose Finish:</span>
                <div className="flex flex-wrap gap-3">
                  {product.variants.map((variant, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSelectedVariant(idx);
                        setSelectedImage(0);
                      }}
                      className={`px-6 py-3 border rounded-sm text-[11px] tracking-widest uppercase transition-all ${
                        selectedVariant === idx 
                          ? "border-primary bg-primary/10 text-primary" 
                          : "border-primary/20 text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {variant.color}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* About section */}
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-[10px] sm:text-[11px] font-bold tracking-[0.2em] uppercase text-primary border-b border-primary/10 pb-2 w-fit">
              Masterpiece Details
            </h2>
            <p className="text-[#888888] text-sm sm:text-base md:text-lg leading-relaxed font-light break-words whitespace-pre-wrap">
              {product.description}
            </p>
          </div>

          <div className="pt-6 sm:pt-8 border-t border-primary/10">
            <div className="flex items-center gap-2 mb-6">
              <div className={`w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-primary animate-pulse' : 'bg-red-500'}`} />
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.15em] font-bold">
                {product.stock > 0 ? (
                  <span className="text-primary">Available In Vault</span>
                ) : (
                  <span className="text-red-500">Currently unavailable</span>
                )}
              </p>
            </div>
            
            <Button
              size="lg"
              className="w-full sm:w-auto h-14 sm:h-16 px-12 sm:px-16 text-[12px] sm:text-[13px] font-bold tracking-[0.2em] uppercase shadow-[0_10px_30px_rgba(201,168,76,0.2)] transition-all hover:-translate-y-1 hover:shadow-[0_15px_40px_rgba(201,168,76,0.3)]"
              onClick={handleAddToCart}
              disabled={product.stock <= 0}
            >
              {product.stock > 0 ? "Add to Session" : "Waitlist Only"}
            </Button>
            
            <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-white/5">
              <div className="flex items-center gap-3 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">★</div>
                Premium Craftsmanship
              </div>
              <div className="flex items-center gap-3 text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">📦</div>
                Discreet Packaging
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
