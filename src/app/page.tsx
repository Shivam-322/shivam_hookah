import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0A]">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative w-full min-h-[100vh] lg:h-[100vh] overflow-hidden flex items-center justify-center py-24 lg:py-0">
        {/* Background image with parallax */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://www.hookah-filters.com/wp-content/uploads/Hookah-without-tobacco-UK.jpg')",
          }}
          data-aos="zoom-out"
          data-aos-duration="2000"
        />
        {/* Smoke / mist overlay */}
        <div className="smoke-overlay absolute inset-0 z-10" />

        <div className="luxury-container relative z-20 text-center flex flex-col items-center px-4 sm:px-6 lg:px-8">
          <p 
            data-aos="fade-up" 
            data-aos-delay="200"
            className="text-[10px] sm:text-[11px] tracking-[0.3em] text-primary uppercase mb-4 sm:mb-6 font-sans font-bold"
          >
            Shivam Hookah
          </p>
          <h1 
            data-aos="fade-up" 
            data-aos-delay="400"
            className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold tracking-[0.05em] mb-4 sm:mb-6 drop-shadow-2xl text-[#F5F5F5] font-serif leading-[1.1] break-words"
          >
            Elevate Your<br />
            <span className="text-primary italic">Smoke Session</span>
          </h1>
          <p 
            data-aos="fade-up" 
            data-aos-delay="600"
            className="mx-auto max-w-[600px] text-sm sm:text-base md:text-lg text-[#888888] font-light mb-8 sm:mb-12 font-sans leading-relaxed"
          >
            Handcrafted hookahs, premium flavors, and everything you need for
            the perfect session.
          </p>
          <div 
            data-aos="fade-up" 
            data-aos-delay="800"
            className="flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center w-full sm:w-auto px-4 sm:px-0"
          >
            <Link href="/catalog" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto px-10 h-14 tracking-widest text-[12px] sm:text-[13px]"
              >
                Explore The Collection
              </Button>
            </Link>
            <Link href="/catalog" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto px-10 h-14 tracking-widest text-[12px] sm:text-[13px]"
              >
                View Best Sellers
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features strip ────────────────────────────────────────────────── */}
      <section className="w-full py-16 lg:py-24 border-y border-primary/10 bg-[#111111]">
        <div className="luxury-container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 lg:gap-16 text-center">
            {[
              {
                icon: "🪔",
                title: "Premium Quality",
                desc: "Handpicked hookah products",
              },
              {
                icon: "🚚",
                title: "Pan India Delivery",
                desc: "Fast & secure shipping",
              },
              {
                icon: "💨",
                title: "Flavor Guarantee",
                desc: "100% authentic flavors",
              },
            ].map((f, i) => (
              <div 
                key={f.title} 
                className="flex flex-col items-center gap-3 sm:gap-4"
                data-aos="fade-up"
                data-aos-delay={100 * (i + 1)}
              >
                <span className="text-3xl sm:text-4xl opacity-80">{f.icon}</span>
                <h3 className="text-base sm:text-lg tracking-[0.1em] text-foreground font-serif uppercase">
                  {f.title}
                </h3>
                <p className="text-[12px] sm:text-[13px] text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Our Finest Picks ──────────────────────────────────────────────── */}
      <section className="w-full py-20 lg:py-32 bg-[#0A0A0A]">
        <div className="luxury-container text-center flex flex-col items-center">
          <span className="section-label" data-aos="fade-up">Our Categories</span>
          <div className="section-label-hr" data-aos="fade-up" data-aos-delay="100"></div>
          
          <h2 
            className="text-3xl sm:text-4xl md:text-5xl mb-12 lg:mb-16 text-foreground font-serif"
            data-aos="fade-up" 
            data-aos-delay="200"
          >
            Finest Picks
          </h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 lg:gap-8 w-full">
            {["Hookah", "Flavors", "Accessories"].map((cat, i) => (
              <Link
                href={`/catalog?category=${cat.toLowerCase()}`}
                key={cat}
                data-aos="fade-up"
                data-aos-delay={100 * (i + 1)}
                className="group relative overflow-hidden rounded-sm aspect-[4/5] bg-[#111111] border border-primary/10 hover:border-primary/50 transition-colors duration-500"
              >
                <div className="absolute inset-0 bg-black/80 group-hover:bg-black/40 transition-colors z-10 duration-500" />
                <div className="absolute inset-0 flex flex-col items-center justify-center z-20 gap-4">
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-[0.15em] uppercase font-serif transform transition-transform duration-500 group-hover:-translate-y-2">
                    {cat}
                  </h3>
                  <span className="text-[10px] sm:text-xs text-primary tracking-[0.2em] uppercase opacity-0 transform translate-y-4 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-500">
                    Explore
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
