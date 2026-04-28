"use client";

import Link from "next/link";
import { ShoppingCart, LogOut, User as UserIcon, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCartStore } from "@/store/useCartStore";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export default function Navbar() {
  const { items } = useCartStore();
  const { user, isAdmin } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  // Close menu on resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent scroll when menu is open
  useEffect(() => {
    if (isMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
  }, [isMenuOpen]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const navLinks = [
    { name: "Home", href: "/" },
    { name: "The Collection", href: "/catalog" },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-primary/20 bg-[#0a0a0a]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#0a0a0a]/80">
      <div className="luxury-container flex h-[70px] md:h-[80px] items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex gap-4 lg:gap-10 items-center">
          <Link href="/" className="flex flex-col items-start leading-none group shrink-0">
            <span className="font-bold inline-block text-primary text-lg sm:text-xl md:text-2xl tracking-[0.1em] font-serif transition-transform duration-500 group-hover:scale-105">
              SHIVAM HOOKAH
            </span>
          </Link>
          <nav className="hidden md:flex gap-6 lg:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="group relative flex items-center text-[12px] lg:text-[13px] font-medium tracking-[0.15em] uppercase text-muted-foreground transition-colors hover:text-primary"
              >
                {link.name}
                <span className="absolute -bottom-1.5 left-0 w-0 h-[1px] bg-primary transition-all duration-300 group-hover:w-full"></span>
              </Link>
            ))}
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
          {isAdmin && (
            <Link href="/admin">
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex border-primary/50 text-primary hover:bg-primary/10 tracking-widest uppercase text-[10px] lg:text-[11px] rounded-sm"
              >
                Admin
              </Button>
            </Link>
          )}

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative hover:text-primary hover:bg-transparent transition-all duration-300">
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse" />
              )}
              <span className="sr-only">Cart</span>
            </Button>
          </Link>

          <div className="hidden sm:flex items-center gap-1 sm:gap-2 md:gap-4">
            {user ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                title="Log Out"
                className="hover:text-primary hover:bg-transparent transition-all duration-300"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="icon" title="Log In" className="hover:text-primary hover:bg-transparent transition-all duration-300">
                  <UserIcon className="h-5 w-5" />
                </Button>
              </Link>
            )}
          </div>

          {/* Hamburger Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden hover:text-primary hover:bg-transparent"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-0 top-[70px] z-50 md:hidden transition-all duration-300 ease-in-out",
          isMenuOpen ? "opacity-100 visible" : "opacity-0 invisible"
        )}
      >
        {/* Overlay */}
        <div 
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMenuOpen(false)}
        />
        
        {/* Content */}
        <div
          className={cn(
            "absolute top-0 right-0 w-full h-auto bg-[#0a0a0a] border-b border-primary/20 py-8 px-6 flex flex-col items-center gap-8 transition-transform duration-300",
            isMenuOpen ? "translate-y-0" : "-translate-y-full"
          )}
        >
          {navLinks.map((link) => (
            <Link
              key={link.name}
              href={link.href}
              className="text-2xl font-serif text-primary tracking-[0.1em] uppercase hover:scale-105 transition-transform"
              onClick={() => setIsMenuOpen(false)}
            >
              {link.name}
            </Link>
          ))}
          
          <div className="flex flex-col items-center gap-6 w-full pt-6 border-t border-primary/10">
            {user ? (
              <Button
                variant="ghost"
                className="text-muted-foreground hover:text-primary text-sm tracking-[0.15em] uppercase font-bold"
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
              >
                <LogOut className="mr-2 h-5 w-5" />
                Logout
              </Button>
            ) : (
              <Link href="/login" onClick={() => setIsMenuOpen(false)} className="w-full">
                <Button className="w-full h-12 tracking-[0.15em] uppercase font-bold">
                  Login / Sign Up
                </Button>
              </Link>
            )}
            
            {isAdmin && (
              <Link href="/admin" onClick={() => setIsMenuOpen(false)} className="w-full">
                <Button variant="outline" className="w-full h-12 border-primary/50 text-primary tracking-[0.15em] uppercase font-bold">
                  Admin Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
