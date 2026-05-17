import type { Metadata } from "next";
import { Inter, Poppins, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AosProvider } from "@/components/AosProvider";
import WhatsAppBubble from "@/components/WhatsAppBubble";
import { OrganizationJsonLd, WebsiteJsonLd } from "@/components/seo/JsonLd";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  variable: "--font-poppins",
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL("https://shivamhookah.in"),
  
  title: {
    default: "Shivam Lifestyle Accessories — Premium Lifestyle Products India",
    template: "%s | Shivam Lifestyle Accessories"
  },
  
  description: "Shop premium hookah, shisha and lifestyle accessories online in India. Best quality hookah pipes, flavours, charcoal and accessories at Shivam Lifestyle Accessories. Free pan-India delivery, secure payments.",
  
  keywords: [
    // ── Brand Keywords ──
    "shivam lifestyle accessories",
    "shivam hookah",
    "shivam hookah store",
    "shivam lifestyle store",

    // ── Hookah Product Keywords ──
    "hookah online india",
    "hookah buy online",
    "hookah pipe online india",
    "best hookah india",
    "premium hookah india",
    "hookah set online",
    "hookah accessories india",
    "hookah accessories online",
    "hookah flavour india",
    "hookah flavour online",
    "shisha online india",
    "shisha accessories india",
    "shisha buy online india",
    "hookah charcoal india",
    "hookah coal online",
    "hookah hose india",
    "hookah bowl india",
    "hookah base india",
    "hookah pipe accessories",
    "hookah starter kit india",
    "hookah setup india",

    // ── Intent Based Keywords ──
    "buy hookah online india",
    "buy shisha online india",
    "hookah shop near me",
    "online hookah store india",
    "hookah delivery india",
    "hookah free shipping india",
    "cheap hookah india",
    "affordable hookah india",
    "hookah under 1000",
    "hookah under 2000",
    "hookah under 500",

    // ── City Based Keywords ──
    "hookah shop delhi",
    "hookah shop mumbai",
    "hookah shop bangalore",
    "hookah shop hyderabad",
    "hookah shop pune",
    "hookah shop chennai",
    "hookah shop kolkata",
    "hookah shop jaipur",
    "hookah shop lucknow",
    "hookah shop prayagraj",
    "hookah online delivery delhi",
    "hookah online delivery mumbai",

    // ── Lifestyle Keywords ──
    "lifestyle accessories india",
    "premium lifestyle products india",
    "leisure accessories online india",
    "social leisure products india",
    "lifestyle accessories shop",
    "buy lifestyle accessories online",

    // ── Long Tail Keywords ──
    "best hookah brand india",
    "hookah for home india",
    "hookah for party india",
    "premium shisha india",
    "hookah with flavour india",
    "hookah accessories kit india",
    "hookah cleaning accessories",
    "modern hookah design india",
    "arabic hookah india",
    "egyptian hookah india",
    "turkish hookah india",
  ],
  
  authors: [{ 
    name: "Shivam Lifestyle Accessories",
    url: "https://shivamhookah.in"
  }],
  
  creator: "Shivam Lifestyle Accessories",
  publisher: "Shivam Lifestyle Accessories",
  
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://shivamhookah.in",
    siteName: "Shivam Lifestyle Accessories",
    title: "Shivam Lifestyle Accessories — Premium Lifestyle Products India",
    description: "Shop premium hookah, shisha and lifestyle accessories online. Best quality products with free pan-India delivery and secure payments.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Shivam Lifestyle Accessories — Premium Lifestyle Products India",
      }
    ],
  },
  
  twitter: {
    card: "summary_large_image",
    title: "Shivam Lifestyle Accessories",
    description: "Premium hookah & lifestyle accessories. Free pan-India delivery.",
    images: ["/images/og-image.jpg"],
  },
  
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  
  verification: {
    google: "YOUR_GOOGLE_VERIFICATION_CODE",
  },
  
  alternates: {
    canonical: "https://shivamhookah.in",
  },
  
  category: "shopping",

  icons: {
    icon: [
      { 
        url: "/favicon.ico",
        sizes: "any",
      },
      { 
        url: "/icon.png", 
        type: "image/png", 
        sizes: "512x512" 
      },
      { 
        url: "/favicon-32x32.png",
        type: "image/png",
        sizes: "32x32" 
      },
      { 
        url: "/favicon-16x16.png",
        type: "image/png",
        sizes: "16x16" 
      },
    ],
    apple: [
      { 
        url: "/apple-icon.png",
        type: "image/png",
        sizes: "180x180" 
      },
    ],
    shortcut: [
      { url: "/favicon.ico" }
    ],
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { 
      media: "(prefers-color-scheme: light)",
      color: "#ffffff" 
    },
    { 
      media: "(prefers-color-scheme: dark)",
      color: "#000000" 
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${cormorant.variable} ${poppins.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
        <OrganizationJsonLd />
        <WebsiteJsonLd />
        <AuthProvider>
          <AosProvider>
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
            <Toaster position="top-center" richColors />
            <WhatsAppBubble />
          </AosProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

