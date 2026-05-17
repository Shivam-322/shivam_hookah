export function OrganizationJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Shivam Lifestyle Accessories",
          url: "https://shivamhookah.in",
          logo: "https://shivamhookah.in/images/og-image.jpg",
          description: "Premium hookah, shisha and lifestyle accessories online store in India. Free pan-India delivery.",
          contactPoint: {
            "@type": "ContactPoint",
            telephone: "+918922942213",
            contactType: "customer service",
            availableLanguage: ["English", "Hindi"],
          },
          sameAs: [
            "https://instagram.com/shivam_lifestyle_accessories",
            "https://facebook.com/shivam_lifestyle_accessories",
          ],
        }),
      }}
    />
  );
}

export function WebsiteJsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Shivam Lifestyle Accessories",
          url: "https://shivamhookah.in",
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://shivamhookah.in/catalog?search={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }),
      }}
    />
  );
}

export function ProductJsonLd({
  product,
}: {
  product: {
    id: string;
    name: string;
    description: string;
    price: number;
    image: string;
    inStock: boolean;
  };
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: product.description,
          image: product.image,
          url: `https://shivamhookah.in/product/${product.id}`,
          brand: {
            "@type": "Brand",
            name: "Shivam Lifestyle Accessories",
          },
          offers: {
            "@type": "Offer",
            price: product.price,
            priceCurrency: "INR",
            availability: product.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
            seller: {
              "@type": "Organization",
              name: "Shivam Lifestyle Accessories",
            },
            url: `https://shivamhookah.in/product/${product.id}`,
          },
        }),
      }}
    />
  );
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[];
}) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: items.map((item, index) => ({
            "@type": "ListItem",
            position: index + 1,
            name: item.name,
            item: item.url,
          })),
        }),
      }}
    />
  );
}
