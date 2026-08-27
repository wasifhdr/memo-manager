"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ADMIN_NAV } from "@/components/nav";

/** The admin section's own secondary nav — a pill-tab row nested under the
 * app shell's ink header. See D:/DESIGN.md §6: "Secondary nav (sub-tabs
 * within a section, e.g. admin) = pill tabs". */
export function AdminSubNav() {
  const pathname = usePathname();

  return (
    <>
      {ADMIN_NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-[var(--radius-pill)] px-3 py-1 text-xs font-bold transition-colors duration-100 ${
              active ? "bg-(--color-paper)/10 text-(--color-gold)" : "text-(--color-cream)/70 hover:bg-(--color-paper)/10 hover:text-(--color-paper)"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}
