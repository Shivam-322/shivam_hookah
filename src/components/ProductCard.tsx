"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useCartStore } from "@/store/useCartStore";
import { toast } from "sonner";

export interface ImageVariant {
  url: string;
  fileId: string;
}

export interface ProductVariant {
  color: string;
  images: ImageVariant[];
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  imageFileId?: string;
  stock: number;
  color?: string;
  variants?: ProductVariant[];
}

export default function ProductCard({ product, priority = false }: { product: Product, priority?: boolean }) {
  const { addItem } = useCartStore();

  const handleAddToCart = () => {
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      color: product.color,
    });
    toast.success(`${product.name} added to your Cart!`);
  };

  return (
    <Card className="group overflow-hidden rounded-sm border border-primary/10 bg-[#111111] transition-all duration-400 hover:shadow-[0_8px_32px_rgba(201,168,76,0.12)] hover:border-primary/50 hover:-translate-y-1 flex flex-col h-full p-2 sm:p-4">
      <Link href={`/product/${product.id}`} className="block relative aspect-square overflow-hidden bg-[#0A0A0A] rounded-sm">
        <Image
          src={product.imageUrl || "/placeholder.svg"}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
          loading={priority ? "eager" : "lazy"}
          className="object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04]"
        />
      </Link>
      <CardContent className="p-2 sm:p-4 flex-grow flex flex-col">
        <h3 className="font-semibold text-xs sm:text-sm line-clamp-1 font-serif text-foreground tracking-wide truncate">{product.name}</h3>
        <p className="text-[10px] sm:text-[12px] text-muted-foreground line-clamp-1 sm:line-clamp-2 mt-1 leading-relaxed flex-grow">{product.description}</p>
        <div className="mt-2 sm:mt-3">
          <p className="text-sm font-semibold text-yellow-500">
            ₹{product.price.toLocaleString("en-IN")}
          </p>
        </div>
      </CardContent>
      <CardFooter className="p-2 sm:p-4 pt-0">
        <Button
          variant="outline"
          className="w-full h-auto py-2 text-[10px] sm:text-xs tracking-widest uppercase font-bold"
          onClick={handleAddToCart}
          disabled={product.stock <= 0}
        >
          {product.stock > 0 ? "Add to Cart" : "Out of Stock"}
        </Button>
      </CardFooter>
    </Card>
  );
}
