import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login — Shivam Lifestyle Accessories",
  description: "Login to your account.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
