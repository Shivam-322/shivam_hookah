import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your Cart — Shivam Lifestyle Accessories",
  description: "Review your cart and checkout securely.",
  robots: {
    index: false, // Don't index cart page
    follow: false,
  },
};

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
