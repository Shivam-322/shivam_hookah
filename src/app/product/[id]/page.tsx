import { adminDb } from "@/lib/firebase-admin";
import { notFound } from "next/navigation";
import ProductDetailClient from "./ProductDetailClient";
import type { Metadata } from "next";
import { ProductJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const productDoc = await adminDb
      .collection("products")
      .doc(id)
      .get();
    
    if (!productDoc.exists) {
      return {
        title: "Product Not Found",
        robots: { index: false, follow: false }
      };
    }
    
    const product = productDoc.data()!;
    const name = product.name || "";
    const price = product.price || 0;
    const description = product.description || "";
    const imageUrl = product.imageUrl || product.image || "/images/logo.jpeg";
    
    return {
      title: `${name} — Buy Online India | Shivam Lifestyle Accessories`,
      description: `Buy ${name} online at ₹${price}. Premium lifestyle accessory with shipping across India. ${description.substring(0, 100)}...`,
      keywords: [
        product.name,
        `buy ${product.name} online`,
        `${product.name} india`,
        `${product.name} price`,
        `${product.name} online india`,
        `best ${product.name} india`,
        "hookah accessories india",
        "shisha accessories india",
        "lifestyle accessories india",
        "buy hookah online india",
        "hookah shop india",
      ],
      alternates: {
        canonical: `https://shivamhookah.in/product/${id}`,
      },
      openGraph: {
        title: `${name} — Shivam Lifestyle Accessories`,
        description: `Buy ${name} online at ₹${price}. Shipping across India.`,
        url: `https://shivamhookah.in/product/${id}`,
        images: [
          { 
            url: imageUrl,
            alt: name,
            width: 800,
            height: 800,
          }
        ],
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: name,
        description: `₹${price} — Shipping across India`,
        images: [imageUrl],
      },
    };
  } catch (error) {
    console.error("Metadata error:", error);
    return {
      title: "Shivam Lifestyle Accessories",
    };
  }
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  
  let productData = null;
  try {
    const productDoc = await adminDb
      .collection("products")
      .doc(id)
      .get();

    if (!productDoc.exists) {
      return notFound();
    }

    const data = productDoc.data()!;
    productData = {
      id: productDoc.id,
      name: data.name || "",
      description: data.description || "",
      price: data.price || 0,
      category: data.category || "",
      imageUrl: data.imageUrl || data.image || "",
      imageFileId: data.imageFileId || "",
      stock: data.stock !== undefined ? data.stock : 0,
      color: data.color || "",
      variants: data.variants || [],
    };
  } catch (error) {
    console.error("Error fetching product on server:", error);
    return notFound();
  }

  const jsonLdProduct = {
    id: productData.id,
    name: productData.name,
    description: productData.description,
    price: productData.price,
    image: productData.imageUrl || "/placeholder.svg",
    inStock: productData.stock > 0,
  };

  return (
    <>
      <ProductJsonLd product={jsonLdProduct} />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "https://shivamhookah.in" },
          { name: "Catalog", url: "https://shivamhookah.in/catalog" },
          { name: productData.name, url: `https://shivamhookah.in/product/${productData.id}` },
        ]}
      />
      <ProductDetailClient product={productData} />
    </>
  );
}

