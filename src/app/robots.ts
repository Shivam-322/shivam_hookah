import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/catalog", "/product/"],
      disallow: [
        "/admin/",
        "/cart",
        "/checkout",
        "/login",
        "/orders",
        "/forgot-password",
        "/reset-password",
        "/signup",
      ],
    },
    sitemap: "https://shivamhookah.in/sitemap.xml",
  };
}
