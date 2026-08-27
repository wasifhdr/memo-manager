"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { directionOnEnter } from "@/components/motion/route-direction";

gsap.registerPlugin(useGSAP);

/** The id the shell's exit tween targets before it pushes the next route. */
export const PAGE_ROOT_ID = "page-root";

/**
 * Entrance half of the route transition. The exit half lives in AppShell,
 * which animates this element out and only then calls router.push().
 *
 * Moving *down* the sidebar: the outgoing page slides up and away, and the
 * incoming page rises from below. Moving up reverses it.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;

      // A plain query rather than gsap.matchMedia(): matchMedia creates its own
      // context, and nesting one inside useGSAP's context gave two revert paths
      // for the same tween, which flashed the from-state on re-invocation.
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        gsap.set(el, { autoAlpha: 1, y: 0 });
        return;
      }

      const dir = directionOnEnter(pathname);

      gsap.fromTo(
        el,
        { autoAlpha: 0, y: 22 * dir },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.34,
          ease: "power2.out",
          overwrite: true,
          // drop the transform so the element can't act as a containing block
          // for anything positioned inside it
          clearProps: "transform",
        },
      );
    },
    { dependencies: [pathname] },
  );

  return (
    <div id={PAGE_ROOT_ID} ref={ref}>
      {children}
    </div>
  );
}
