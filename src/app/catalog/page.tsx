import CatalogClient from "./CatalogClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop All Products — Lifestyle Accessories Collection",
  description: "Browse our complete collection of premium hookah pipes, shisha flavours, hookah charcoal, accessories and lifestyle products. Best prices with free pan-India shipping.",
  alternates: {
    canonical: "https://shivamhookah.in/catalog",
  },
  openGraph: {
    title: "Shop All Products — Shivam Lifestyle Accessories",
    description: "Browse premium lifestyle accessories. Shipping across India.",
    url: "https://shivamhookah.in/catalog",
  },
};

export default function CatalogPage() {
  return <CatalogClient />;
}

