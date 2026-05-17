import type { Metadata } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AosProvider } from "@/components/AosProvider";
import WhatsAppBubble from "@/components/WhatsAppBubble";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

export const metadata: Metadata = {
  title: {
    default: "Shivam Lifestyle Accessories",
    template: "%s | Shivam Lifestyle Accessories"
  },
  description: "Premium lifestyle accessories and leisure products for the modern Indian consumer. Shop curated personal accessories with pan-India delivery.",
  keywords: [
    "lifestyle accessories",
    "premium accessories",
    "leisure products",
    "lifestyle store india",
    "personal accessories",
    "shivam lifestyle"
  ],
  openGraph: {
    title: "Shivam Lifestyle Accessories",
    description: "Premium lifestyle accessories for the modern Indian consumer.",
    siteName: "Shivam Lifestyle Accessories",
    locale: "en_IN",
    type: "website",
  },
  twitter: {
    title: "Shivam Lifestyle Accessories",
    description: "Premium lifestyle accessories for the modern Indian consumer.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${cormorant.variable} antialiased min-h-screen flex flex-col`}
        suppressHydrationWarning
      >
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
