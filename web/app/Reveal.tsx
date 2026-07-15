"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Adds `.in` to [data-reveal] elements as they scroll into view.
 *  Mounted once in the layout; re-scans on each route change so client-side
 *  navigations animate too. If `reveal-ready` isn't set (reduced motion / no
 *  JS at boot), elements are already visible and this is a no-op. */
export default function Reveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (!document.documentElement.classList.contains("reveal-ready")) return;

    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]:not(.in)"));
    if (!els.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          // Reveal when the element enters view, OR when it has already been
          // scrolled past (top < 0) — the latter guards against mid-page
          // refreshes and anchor/programmatic jumps leaving content hidden.
          if (e.isIntersecting || e.boundingClientRect.top < 0) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );

    els.forEach((el) => io.observe(el));

    // Safety net: any [data-reveal] that is in or above the viewport but hasn't
    // been revealed yet (observer edge case, anchor/programmatic jump) is shown
    // quickly enough to be imperceptible. Below-fold elements are untouched so
    // they still animate in on scroll.
    const failsafe = window.setTimeout(() => {
      document.querySelectorAll<HTMLElement>("[data-reveal]:not(.in)").forEach((el) => {
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("in");
      });
    }, 400);

    return () => {
      io.disconnect();
      window.clearTimeout(failsafe);
    };
  }, [pathname]);

  return null;
}
