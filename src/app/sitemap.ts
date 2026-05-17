import { MetadataRoute } from "next";
import { adminDb } from "@/lib/firebase-admin";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticUrls: MetadataRoute.Sitemap = [
    {
      url: "https://shivamhookah.in",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: "https://shivamhookah.in/catalog",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  try {
    const productsSnapshot = await adminDb.collection("products").get();
    const productUrls = productsSnapshot.docs.map((doc) => {
      const data = doc.data();
      let lastModified = new Date();
      if (data.updatedAt) {
        if (typeof data.updatedAt.toDate === "function") {
          lastModified = data.updatedAt.toDate();
        } else {
          lastModified = new Date(data.updatedAt);
        }
      } else if (data.createdAt) {
        if (typeof data.createdAt.toDate === "function") {
          lastModified = data.createdAt.toDate();
        } else {
          lastModified = new Date(data.createdAt);
        }
      }
      
      return {
        url: `https://shivamhookah.in/product/${doc.id}`,
        lastModified,
        changeFrequency: "weekly" as const,
        priority: 0.8,
      };
    });

    return [...staticUrls, ...productUrls];
  } catch (error) {
    console.error("Sitemap generation error:", error);
    return staticUrls;
  }
}
