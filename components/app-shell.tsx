"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, ADMIN_NAV, type NavItem } from "@/components/nav";
import { IconClose, IconLogout, IconMenu } from "@/components/ui/icons";

export function AppShell({
  orgName,
  hasLogo = false,
  userName,
  userRole,
  unreadCount = 0,
  logoutAction,
  children,
}: {
  orgName: string;
  hasLogo?: boolean;
  userName: string;
  userRole: "org_admin" | "user";
  unreadCount?: number;
  logoutAction?: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const orgInitial = orgName.trim().charAt(0).toUpperCase() || "M";
  const isAdmin = userRole === "org_admin";

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  const isActive = (href: string) => {
    if (href === "/dashboard" || href === "/admin") return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  function NavLink({ item }: { item: NavItem }) {
    const active = isActive(item.href);
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        aria-current={active ? "page" : undefined}
        className={`group flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-bold transition-colors duration-150 ${
          active
            ? "bg-(--color-paper)/12 text-(--color-paper)"
            : "text-(--color-cream)/70 hover:bg-(--color-paper)/8 hover:text-(--color-paper)"
        }`}
      >
        <Icon className={`size-4.5 shrink-0 ${active ? "text-(--color-gold)" : "text-(--color-cream)/60 group-hover:text-(--color-cream)"}`} />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.badge === "notifications" && unreadCount > 0 ? (
          <span className="flex min-w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-gold) px-1.5 py-0.5 text-[0.625rem] font-extrabold leading-none text-(--color-ink)">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </Link>
    );
  }

  /** The sidebar's contents — shared by the fixed desktop rail and the mobile drawer. */
  const sidebarBody = (
    <>
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-4">
        {hasLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/api/org-logo" alt="" className="size-9 shrink-0 rounded-[var(--radius-control)] object-contain" />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-(--color-orange) font-display text-base font-extrabold text-white">
            {orgInitial}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[0.9375rem] font-extrabold leading-tight text-(--color-paper)">
            {orgName}
          </span>
          <span className="block truncate text-[0.6875rem] text-(--color-cream)/55">Memo Manager</span>
        </span>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-3">
        {NAV.map((item) => <NavLink key={item.href} item={item} />)}

        {isAdmin ? (
          <>
            <p className="mt-5 mb-1 px-3 text-label uppercase text-(--color-cream)/45">Administration</p>
            {ADMIN_NAV.map((item) => <NavLink key={item.href} item={item} />)}
          </>
        ) : null}
      </nav>

      <div className="shrink-0 border-t border-(--color-paper)/10 p-3">
        <Link
          href="/profile"
          className="mb-1 flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-2 transition-colors duration-150 hover:bg-(--color-paper)/8"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-paper)/15 text-xs font-extrabold text-(--color-paper)">
            {userName.trim().charAt(0).toUpperCase() || "?"}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[0.8125rem] font-bold text-(--color-paper)">{userName}</span>
            <span className="block truncate text-[0.6875rem] text-(--color-cream)/55">
              {isAdmin ? "Admin" : "Member"}
            </span>
          </span>
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-bold text-(--color-cream)/70 transition-colors duration-150 hover:bg-(--color-red)/20 hover:text-(--color-paper)"
          >
            <IconLogout className="size-4.5 shrink-0" />
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-(--color-ink) text-(--color-paper) lg:flex">
        {sidebarBody}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-(--color-ink)/50 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-(--color-ink) text-(--color-paper)">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 flex size-8 items-center justify-center rounded-[var(--radius-dot)] text-(--color-cream)/70 hover:bg-(--color-paper)/10 hover:text-(--color-paper)"
            >
              <IconClose className="size-4" />
            </button>
            {sidebarBody}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — just the drawer trigger and identity */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 bg-(--color-ink) px-4 text-(--color-paper) lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-dot)] text-(--color-cream)/80 hover:bg-(--color-paper)/10 hover:text-(--color-paper)"
          >
            <IconMenu className="size-4.5" />
          </button>
          <span className="min-w-0 flex-1 truncate font-display text-base font-extrabold">{orgName}</span>
          {unreadCount > 0 ? (
            <Link
              href="/notifications"
              className="flex min-w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-gold) px-1.5 py-0.5 text-[0.625rem] font-extrabold text-(--color-ink)"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Link>
          ) : null}
        </header>

        {/* keyed by route so each navigation replays the entrance animation */}
        <main key={pathname} className="animate-fade-rise mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
