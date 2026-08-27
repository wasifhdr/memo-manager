"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, ADMIN_NAV, type NavItem } from "@/components/nav";
import { IconChevronDown, IconChevronLeft, IconClose, IconLogout, IconMenu } from "@/components/ui/icons";

const COLLAPSE_KEY = "mm.sidebarCollapsed";

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
  const pathname = usePathname();
  const orgInitial = orgName.trim().charAt(0).toUpperCase() || "M";
  const isAdmin = userRole === "org_admin";
  const isAdminRoute = pathname.startsWith("/admin");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(isAdminRoute);
  // Server always renders expanded; the stored preference is applied after
  // mount so the markup can't mismatch during hydration.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSE_KEY) === "1") setCollapsed(true);
    } catch { /* storage unavailable — stay expanded */ }
  }, []);

  function setCollapsedPersisted(next: boolean) {
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0"); } catch { /* ignore */ }
  }

  // Landing on an admin route should always reveal that section.
  useEffect(() => {
    if (isAdminRoute) setAdminOpen(true);
  }, [isAdminRoute]);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

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

  // Plain functions rather than nested components: a component declared inside
  // the render would get a new identity each pass and remount the whole nav.
  function navLink(item: NavItem, mini: boolean) {
    const active = isActive(item.href);
    const Icon = item.icon;
    const showBadge = item.badge === "notifications" && unreadCount > 0;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        title={mini ? item.label : undefined}
        className={`group relative flex items-center rounded-[var(--radius-control)] py-2 text-sm font-bold transition-colors duration-150 ${
          mini ? "justify-center px-0" : "gap-3 px-3"
        } ${
          active
            ? "bg-(--color-paper)/12 text-(--color-paper)"
            : "text-(--color-cream)/70 hover:bg-(--color-paper)/8 hover:text-(--color-paper)"
        }`}
      >
        <span className="relative shrink-0">
          <Icon className={`size-4.5 ${active ? "text-(--color-gold)" : "text-(--color-cream)/60 group-hover:text-(--color-cream)"}`} />
          {/* collapsed: the count has nowhere to sit, so show a dot on the glyph */}
          {mini && showBadge ? (
            <span className="absolute -right-1 -top-0.5 size-2 rounded-[var(--radius-pill)] bg-(--color-gold)" />
          ) : null}
        </span>
        {mini ? null : (
          <>
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {showBadge ? (
              <span className="flex min-w-5 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-gold) px-1.5 py-0.5 text-[0.625rem] font-extrabold leading-none text-(--color-ink)">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </>
        )}
      </Link>
    );
  }

  /** `mini` renders the icon-only rail; the mobile drawer always passes false. */
  function sidebarBody(mini: boolean) {
    return (
      <>
        <div className={`flex h-16 shrink-0 items-center ${mini ? "justify-center px-2" : "gap-2.5 px-4"}`}>
          {mini ? (
            <button
              type="button"
              onClick={() => setCollapsedPersisted(false)}
              aria-label="Expand sidebar"
              aria-expanded={false}
              title="Expand sidebar"
              className="flex size-10 items-center justify-center rounded-[var(--radius-control)] transition-colors duration-150 hover:bg-(--color-paper)/10 focus-visible:outline-[3px] focus-visible:outline-(--color-gold) focus-visible:outline-offset-2"
            >
              {hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src="/api/org-logo" alt="" className="size-9 rounded-[var(--radius-control)] object-contain" />
              ) : (
                <span className="flex size-9 items-center justify-center rounded-[var(--radius-control)] bg-(--color-orange) font-display text-base font-extrabold text-white">
                  {orgInitial}
                </span>
              )}
            </button>
          ) : (
            <>
              <Link href="/dashboard" className="flex min-w-0 flex-1 items-center gap-2.5">
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
              </Link>
              {/* desktop-only: the drawer has its own close button */}
              <button
                type="button"
                onClick={() => setCollapsedPersisted(true)}
                aria-label="Collapse sidebar"
                aria-expanded
                title="Collapse sidebar"
                className="hidden size-7 shrink-0 items-center justify-center rounded-[var(--radius-dot)] text-(--color-cream)/60 transition-colors duration-150 hover:bg-(--color-paper)/10 hover:text-(--color-paper) lg:flex"
              >
                <IconChevronLeft className="size-4" />
              </button>
            </>
          )}
        </div>

        <nav className={`no-scrollbar flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-3 ${mini ? "px-2" : "px-3"}`}>
          {NAV.map((item) => navLink(item, mini))}

          {isAdmin ? (
            mini ? (
              <>
                <div className="my-2 border-t border-(--color-paper)/10" />
                {ADMIN_NAV.map((item) => navLink(item, true))}
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setAdminOpen((v) => !v)}
                  aria-expanded={adminOpen}
                  aria-controls="sidebar-admin-section"
                  className="mt-5 mb-1 flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-1.5 text-label uppercase text-(--color-cream)/45 transition-colors duration-150 hover:bg-(--color-paper)/8 hover:text-(--color-cream)/70"
                >
                  <span className="min-w-0 flex-1 truncate text-left">Administration</span>
                  <IconChevronDown
                    className={`size-3.5 shrink-0 transition-transform duration-200 ${adminOpen ? "" : "-rotate-90"}`}
                  />
                </button>
                {adminOpen ? (
                  <div id="sidebar-admin-section" className="flex flex-col gap-0.5">
                    {ADMIN_NAV.map((item) => navLink(item, false))}
                  </div>
                ) : null}
              </>
            )
          ) : null}
        </nav>

        <div className={`shrink-0 border-t border-(--color-paper)/10 ${mini ? "p-2" : "p-3"}`}>
          <Link
            href="/profile"
            title={mini ? userName : undefined}
            className={`mb-1 flex items-center rounded-[var(--radius-control)] py-2 transition-colors duration-150 hover:bg-(--color-paper)/8 ${
              mini ? "justify-center px-0" : "gap-2.5 px-2"
            }`}
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-pill)] bg-(--color-paper)/15 text-xs font-extrabold text-(--color-paper)">
              {userName.trim().charAt(0).toUpperCase() || "?"}
            </span>
            {mini ? null : (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-bold text-(--color-paper)">{userName}</span>
                <span className="block truncate text-[0.6875rem] text-(--color-cream)/55">{isAdmin ? "Admin" : "Member"}</span>
              </span>
            )}
          </Link>
          <form action={logoutAction}>
            <button
              type="submit"
              title={mini ? "Sign out" : undefined}
              className={`flex w-full items-center rounded-[var(--radius-control)] py-2 text-sm font-bold text-(--color-cream)/70 transition-colors duration-150 hover:bg-(--color-red)/20 hover:text-(--color-paper) ${
                mini ? "justify-center px-0" : "gap-3 px-3"
              }`}
            >
              <IconLogout className="size-4.5 shrink-0" />
              {mini ? null : "Sign out"}
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col bg-(--color-ink) text-(--color-paper) transition-[width] duration-200 lg:flex ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {sidebarBody(collapsed)}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-(--color-ink)/50 backdrop-blur-[2px]" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-(--color-ink) text-(--color-paper)">
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-4 z-10 flex size-8 items-center justify-center rounded-[var(--radius-dot)] text-(--color-cream)/70 hover:bg-(--color-paper)/10 hover:text-(--color-paper)"
            >
              <IconClose className="size-4" />
            </button>
            {sidebarBody(false)}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
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

        <main key={pathname} className="animate-fade-rise mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
