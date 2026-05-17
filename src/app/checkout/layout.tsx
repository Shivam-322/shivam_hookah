import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Checkout — Shivam Lifestyle Accessories",
  description: "Complete your order securely.",
  robots: {
    index: false, // Don't index checkout
    follow: false,
  },
};

export default function CheckoutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
