"use client";

import { useCartStore } from "@/store/useCartStore";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Trash2, Plus, Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function CartPage() {
  const { items, removeItem, updateQuantity, getTotal } = useCartStore();
  const { user } = useAuth();
  const router = useRouter();

  const handleCheckout = () => {
    if (user) {
      router.push("/checkout");
    } else {
      router.push("/login?redirect=/checkout");
    }
  };

  if (items.length === 0) {
    return (
      <div className="luxury-container section-padding text-center max-w-2xl px-4">
        <h1 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6 tracking-tight text-primary font-serif">
          Your Cart is Empty
        </h1>
        <p className="text-[#888888] mb-8 sm:mb-10 text-base sm:text-lg">
          Looks like you haven't added anything yet. Explore our collection.
        </p>
        <Link href="/catalog">
          <Button className="font-bold h-12 sm:h-14 px-8 text-[12px] sm:text-[13px] w-full sm:w-auto tracking-widest uppercase">
            Browse The Collection
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="luxury-container section-padding min-h-screen px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col items-start mb-10 sm:mb-12" data-aos="fade-up">
        <span className="section-label">Your Selection</span>
        <div className="section-label-hr"></div>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-[0.05em] text-[#F5F5F5] font-serif mt-2 sm:mt-4">
          Shopping Cart
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16">
        {/* Items */}
        <div className="lg:col-span-2 space-y-6 sm:space-y-8" data-aos="fade-right">
          {items.map((item) => (
            <div
              key={`${item.productId}-${item.color || 'default'}`}
              className="flex flex-col sm:flex-row gap-6 sm:gap-8 p-4 sm:p-8 border border-primary/10 rounded-sm bg-[#111111] hover:border-primary/30 transition-all duration-500 group"
            >
              <div className="relative w-full sm:w-32 h-48 sm:h-40 bg-black rounded-sm overflow-hidden flex-shrink-0 border border-primary/5">
                <Image
                  src={item.imageUrl || "/placeholder.svg"}
                  alt={item.name}
                  fill
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 20vw, 10vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <div className="flex-grow flex flex-col justify-between py-1">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                  <div>
                    <h3 className="text-lg sm:text-xl font-serif text-[#F5F5F5] tracking-wide">{item.name}</h3>
                    {item.color && (
                      <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.2em] text-primary mt-1 sm:mt-2 font-bold">
                        Finish: {item.color}
                      </p>
                    )}
                  </div>
                  <p className="font-bold text-primary text-lg sm:text-xl tracking-wider">
                    ₹{(item.price * item.quantity).toLocaleString("en-IN")}
                  </p>
                </div>
                
                <div className="flex items-center justify-between mt-6 sm:mt-8">
                  <div className="flex items-center border border-primary/20 rounded-sm overflow-hidden bg-black/40">
                    <button
                      className="px-3 sm:px-4 py-2 hover:bg-primary/10 transition-colors text-primary"
                      onClick={() =>
                        updateQuantity(item.productId, item.color, Math.max(1, item.quantity - 1))
                      }
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="px-4 sm:px-6 py-2 border-x border-primary/10 font-bold text-[10px] sm:text-xs tracking-widest text-[#F5F5F5]">
                      {item.quantity}
                    </span>
                    <button
                      className="px-3 sm:px-4 py-2 hover:bg-primary/10 transition-colors text-primary"
                      onClick={() => updateQuantity(item.productId, item.color, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-red-500 hover:bg-red-500/5 h-10 w-10 transition-all"
                    onClick={() => removeItem(item.productId, item.color)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="lg:col-span-1" data-aos="fade-left" data-aos-delay="200">
          <div className="bg-[#111111] p-6 sm:p-10 rounded-sm border border-primary/20 h-fit sticky top-24 sm:top-32 shadow-2xl shadow-black">
            <h2 className="text-lg sm:text-xl font-bold mb-6 sm:mb-8 border-b border-primary/10 pb-4 tracking-[0.1em] font-serif text-[#F5F5F5] uppercase">
              Order Summary
            </h2>
            <div className="space-y-4 sm:space-y-6 mb-8 sm:mb-10">
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-[#888888] uppercase tracking-[0.1em]">Subtotal</span>
                <span className="font-bold text-[#F5F5F5] tracking-wider text-base sm:text-lg">₹{getTotal().toLocaleString("en-IN")}</span>
              </div>
              <div className="flex justify-between items-center text-xs sm:text-sm">
                <span className="text-[#888888] uppercase tracking-[0.1em]">Concierge Delivery</span>
                <span className="text-[9px] sm:text-[10px] font-bold text-primary tracking-widest">CALCULATED NEXT</span>
              </div>
              <div className="border-t border-primary/10 pt-6 sm:pt-8 flex justify-between mt-4 sm:mt-6">
                <span className="font-bold text-base sm:text-lg tracking-[0.2em] text-[#F5F5F5] uppercase font-serif">Grand Total</span>
                <span className="font-bold text-xl sm:text-2xl text-primary tracking-tighter">
                  ₹{getTotal().toLocaleString("en-IN")}
                </span>
              </div>
            </div>
            <Button
              className="w-full font-bold text-[11px] sm:text-[12px] tracking-[0.2em] h-12 sm:h-14 uppercase shadow-[0_10px_30px_rgba(201,168,76,0.15)] hover:shadow-[0_15px_40px_rgba(201,168,76,0.25)] transition-all hover:-translate-y-0.5"
              onClick={handleCheckout}
            >
              Proceed to Checkout
            </Button>
            <p className="text-[9px] sm:text-[10px] text-muted-foreground text-center mt-6 uppercase tracking-[0.1em]">
              Complimentary session insurance included
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
