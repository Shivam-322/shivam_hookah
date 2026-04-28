import type { Metadata } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AosProvider } from "@/components/AosProvider";

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
  title: "Shivam Hookah — Premium Luxury Experience",
  description:
    "Handcrafted hookahs, premium shisha flavors, and everything you need for the perfect session.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} ${cormorant.variable} antialiased min-h-screen flex flex-col`}
      >
        <AuthProvider>
          <AosProvider>
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
            <Toaster position="top-center" richColors />
          </AosProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
