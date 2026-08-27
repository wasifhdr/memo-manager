"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { consumeDirection } from "@/components/motion/route-direction";

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

      const mm = gsap.matchMedia();
      mm.add(
        {
          motionOk: "(prefers-reduced-motion: no-preference)",
          reduceMotion: "(prefers-reduced-motion: reduce)",
        },
        (ctx) => {
          const { reduceMotion } = ctx.conditions as { reduceMotion: boolean };
          const dir = consumeDirection();

          if (reduceMotion) {
            gsap.set(el, { autoAlpha: 1, y: 0 });
            return;
          }

          gsap.fromTo(
            el,
            { autoAlpha: 0, y: 22 * dir },
            { autoAlpha: 1, y: 0, duration: 0.34, ease: "power2.out", clearProps: "transform" },
          );
        },
      );
      return () => mm.revert();
    },
    { dependencies: [pathname], revertOnUpdate: true },
  );

  return (
    <div id={PAGE_ROOT_ID} ref={ref}>
      {children}
    </div>
  );
}
