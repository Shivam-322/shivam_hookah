import Link from "next/link";
import { Instagram, Twitter, Facebook } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-primary/20 bg-[#050505] py-12 sm:py-16 mt-auto">
      <div className="luxury-container px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-12 md:gap-10">
          {/* Brand */}
          <div className="text-center md:text-left">
            <h2 className="font-bold text-primary tracking-[0.1em] text-xl sm:text-2xl mb-2 font-serif uppercase">
              SHIVAM HOOKAH
            </h2>
            <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase hidden md:block">The Art of Session</p>
          </div>

          {/* Links */}
          <nav className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 text-[11px] sm:text-[13px] tracking-[0.15em] uppercase text-muted-foreground font-medium">
            <Link href="/" className="hover:text-primary transition-colors duration-300">
              Home
            </Link>
            <Link href="/catalog" className="hover:text-primary transition-colors duration-300">
              Collection
            </Link>
            <Link href="/cart" className="hover:text-primary transition-colors duration-300">
              Cart
            </Link>
            <Link href="/login" className="hover:text-primary transition-colors duration-300">
              Contact
            </Link>
          </nav>
          
          {/* Social Icons */}
          <div className="flex gap-6 sm:gap-4">
            <Link href="#" className="text-muted-foreground hover:text-primary border border-primary/10 hover:border-primary/50 p-2.5 rounded-full transition-all duration-300 bg-primary/5">
              <Instagram className="w-4 h-4" />
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-primary border border-primary/10 hover:border-primary/50 p-2.5 rounded-full transition-all duration-300 bg-primary/5">
              <Twitter className="w-4 h-4" />
            </Link>
            <Link href="#" className="text-muted-foreground hover:text-primary border border-primary/10 hover:border-primary/50 p-2.5 rounded-full transition-all duration-300 bg-primary/5">
              <Facebook className="w-4 h-4" />
            </Link>
          </div>
        </div>

        <div className="mt-12 border-t border-primary/10 pt-8 text-center flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] sm:text-xs text-muted-foreground tracking-widest uppercase">
          <p>
            &copy; {new Date().getFullYear()} Shivam Hookah. All rights reserved.
          </p>
          <div className="flex gap-4 sm:gap-8">
            <p className="hidden sm:block">Crafted for the culture.</p>
            <Link href="#" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
