"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import AOS from "aos";
import "aos/dist/aos.css";

export function AosProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    AOS.init({
      duration: 800,
      easing: "ease-out-cubic",
      once: true,
      offset: 50,
    });
  }, []);

  // Re-scan the DOM for new AOS elements on every client-side route change.
  // Without this, navigating via <Link> or router.push() means new page
  // elements with data-aos attributes are never detected by the AOS observer.
  useEffect(() => {
    const timeout = setTimeout(() => {
      AOS.refreshHard();
    }, 150);
    return () => clearTimeout(timeout);
  }, [pathname]);

  return <>{children}</>;
}
