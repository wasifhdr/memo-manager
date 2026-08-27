"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/components/nav";
import { IconBell, IconChevronDown, IconClose, IconMenu } from "@/components/ui/icons";

type ShellUser = {
  name: string;
  role: "org_admin" | "user";
};

export function AppShell({
  orgName,
  hasLogo = false,
  userName,
  userRole,
  unreadCount = 0,
  logoutAction,
  secondaryNav,
  children,
}: {
  orgName: string;
  hasLogo?: boolean;
  userName: ShellUser["name"];
  userRole: ShellUser["role"];
  unreadCount?: number;
  logoutAction?: () => void | Promise<void>;
  /** An admin section's own pill-tab sub-nav — see D:/DESIGN.md §6: "Secondary
   * nav (sub-tabs within a section, e.g. admin) = pill tabs". */
  secondaryNav?: ReactNode;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const orgInitial = orgName.trim().charAt(0).toUpperCase() || "M";

  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));
  const isAdminActive = pathname.startsWith("/admin");

  const pillLink = (href: string, active: boolean) =>
    `shrink-0 rounded-[var(--radius-pill)] px-3 py-1.5 text-sm font-bold transition-colors duration-100 ${
      active ? "bg-(--color-paper)/10 text-(--color-gold)" : "text-(--color-cream)/75 hover:bg-(--color-paper)/10 hover:text-(--color-paper)"
    }`;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 bg-(--color-ink) text-(--color-paper)">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link href="/dashboard" className="flex min-w-0 shrink-0 items-center gap-2">
            {hasLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src="/api/org-logo" alt="" className="size-7 shrink-0 rounded-[var(--radius-dot)] object-contain" />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-[var(--radius-dot)] bg-(--color-orange) text-sm font-extrabold text-white">
                {orgInitial}
              </span>
            )}
            <span className="truncate font-display text-lg font-extrabold tracking-tight text-(--color-paper) max-[899px]:max-w-32">
              {orgName}
            </span>
          </Link>

          <nav className="hidden min-[900px]:flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined} className={pillLink(item.href, isActive(item.href))}>
                {item.label}
              </Link>
            ))}
            {userRole === "org_admin" ? (
              <Link href="/admin" aria-current={isAdminActive ? "page" : undefined} className={pillLink("/admin", isAdminActive)}>
                Administration
              </Link>
            ) : null}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-1">
            <Link
              href="/notifications"
              aria-label="Notifications"
              className="relative flex size-9 items-center justify-center rounded-[var(--radius-dot)] text-(--color-cream)/75 hover:bg-(--color-paper)/10 hover:text-(--color-paper)"
            >
              <IconBell className="size-4.5" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex min-w-3.5 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-gold) px-1 text-[0.625rem] font-bold leading-3.5 text-(--color-ink)">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Link>

            <div className="relative hidden min-[900px]:block">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-[var(--radius-pill)] py-1.5 pl-2 pr-2.5 text-xs font-bold text-(--color-cream)/75 hover:bg-(--color-paper)/10 hover:text-(--color-paper)"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-paper)/15 text-[0.6875rem] font-extrabold text-(--color-paper)">
                  {userName.trim().charAt(0).toUpperCase() || "?"}
                </span>
                <span className="max-w-24 truncate">{userName}</span>
                <IconChevronDown className={`size-3 shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
              </button>
              {menuOpen ? (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full z-40 mt-2 w-48 overflow-hidden rounded-[var(--radius-card)] border-2 border-(--color-ink) bg-(--color-paper) text-(--color-ink) shadow-offset">
                    <Link href="/profile" onClick={() => setMenuOpen(false)} className="block px-3.5 py-2.5 text-sm font-medium hover:bg-(--color-cream)">
                      Profile &amp; password
                    </Link>
                    <Link href="/delegations" onClick={() => setMenuOpen(false)} className="block px-3.5 py-2.5 text-sm font-medium hover:bg-(--color-cream)">
                      Delegations
                    </Link>
                    <form action={logoutAction} className="border-t border-(--color-sand)">
                      <button type="submit" className="block w-full px-3.5 py-2.5 text-left text-sm font-bold text-(--color-red-deep) hover:bg-(--color-cream)">
                        Log out
                      </button>
                    </form>
                  </div>
                </>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="flex size-9 items-center justify-center rounded-[var(--radius-dot)] text-(--color-cream)/75 hover:bg-(--color-paper)/10 hover:text-(--color-paper) min-[900px]:hidden"
            >
              <IconMenu className="size-4.5" />
            </button>
          </div>
        </div>

        {secondaryNav ? (
          <div className="border-t border-(--color-paper)/10">
            <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2 sm:px-6">{secondaryNav}</div>
          </div>
        ) : null}
      </header>

      {/* Mobile drawer — full nav, since §22 requires the app stay usable on
          mobile (the design contract's own default, "collapse to brand +
          logout", is widened here). */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 min-[900px]:hidden">
          <div className="absolute inset-0 bg-(--color-ink)/50 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 flex w-72 max-w-[85vw] flex-col bg-(--color-ink) text-(--color-paper) shadow-offset-lg">
            <div className="flex h-14 items-center justify-between border-b border-(--color-paper)/10 px-4">
              <span className="truncate font-display text-lg font-extrabold">{orgName}</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex size-8 items-center justify-center rounded-[var(--radius-dot)] text-(--color-cream)/75 hover:bg-(--color-paper)/10 hover:text-(--color-paper)"
              >
                <IconClose className="size-4" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setDrawerOpen(false)}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm font-bold ${
                    isActive(item.href) ? "bg-(--color-paper)/10 text-(--color-gold)" : "text-(--color-cream)/85 hover:bg-(--color-paper)/10"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              {userRole === "org_admin" ? (
                <Link
                  href="/admin"
                  onClick={() => setDrawerOpen(false)}
                  aria-current={isAdminActive ? "page" : undefined}
                  className={`rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm font-bold ${
                    isAdminActive ? "bg-(--color-paper)/10 text-(--color-gold)" : "text-(--color-cream)/85 hover:bg-(--color-paper)/10"
                  }`}
                >
                  Administration
                </Link>
              ) : null}
              <div className="my-2 border-t border-(--color-paper)/10" />
              <Link href="/profile" onClick={() => setDrawerOpen(false)} className="rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm font-bold text-(--color-cream)/85 hover:bg-(--color-paper)/10">
                Profile &amp; password
              </Link>
              <Link href="/delegations" onClick={() => setDrawerOpen(false)} className="rounded-[var(--radius-control)] px-3.5 py-2.5 text-sm font-bold text-(--color-cream)/85 hover:bg-(--color-paper)/10">
                Delegations
              </Link>
            </nav>
            <div className="border-t border-(--color-paper)/10 p-3">
              <div className="mb-2 px-1 text-xs text-(--color-cream)/60">{userName} · {userRole === "org_admin" ? "Organization admin" : "Member"}</div>
              <form action={logoutAction}>
                <button type="submit" className="w-full rounded-[var(--radius-control)] bg-(--color-red) px-3.5 py-2.5 text-left text-sm font-bold text-white hover:bg-(--color-red-deep)">
                  Log out
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
