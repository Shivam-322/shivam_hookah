import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My Orders — Shivam Lifestyle Accessories",
  description: "Track and manage your orders.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function OrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
