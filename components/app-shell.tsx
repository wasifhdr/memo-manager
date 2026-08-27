"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, ADMIN_NAV } from "@/components/nav";
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
  children,
}: {
  orgName: string;
  hasLogo?: boolean;
  userName: ShellUser["name"];
  userRole: ShellUser["role"];
  unreadCount?: number;
  logoutAction?: () => void | Promise<void>;
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const orgInitial = orgName.trim().charAt(0).toUpperCase() || "M";

  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const NavList = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <div className="px-3 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-(--text-faint)">
        Workspace
      </div>
      <nav className="flex flex-col gap-0.5 px-2">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive(item.href) ? "page" : undefined}
            className={`rounded-[var(--radius-sm)] px-3 py-2 text-[0.8125rem] font-medium transition-colors ${
              isActive(item.href)
                ? "bg-(--accent-tint) text-(--accent)"
                : "text-(--text-muted) hover:bg-(--surface-sunken) hover:text-(--text)"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {userRole === "org_admin" ? (
        <>
          <div className="px-3 pb-1 pt-5 text-[0.6875rem] font-semibold uppercase tracking-wide text-(--text-faint)">
            Administration
          </div>
          <nav className="flex flex-col gap-0.5 px-2">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`rounded-[var(--radius-sm)] px-3 py-2 text-[0.8125rem] font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-(--accent-tint) text-(--accent)"
                    : "text-(--text-muted) hover:bg-(--surface-sunken) hover:text-(--text)"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </>
      ) : null}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-(--border) bg-(--surface) md:flex">
        <div className="flex items-center gap-2.5 border-b border-(--border) px-4 py-4">
          {hasLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/api/org-logo" alt="" className="size-8 shrink-0 rounded-[var(--radius-sm)] object-contain" />
          ) : (
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-(--accent) font-serif-heading text-[0.9375rem] font-semibold text-(--text-on-accent)">
              {orgInitial}
            </span>
          )}
          <span className="truncate text-[0.9375rem] font-semibold text-(--text)">{orgName}</span>
        </div>
        <div className="flex-1 overflow-y-auto py-3">
          <NavList />
        </div>
        <UserMenu userName={userName} userRole={userRole} logoutAction={logoutAction} unreadCount={unreadCount} />
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-(--border) bg-(--surface) px-4 py-3 md:hidden">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-(--text-muted) hover:bg-(--surface-sunken)"
          >
            <IconMenu className="size-4.5" />
          </button>
          <span className="truncate text-[0.9375rem] font-semibold text-(--text)">{orgName}</span>
        </div>
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-(--text-muted) hover:bg-(--surface-sunken)"
        >
          <IconBell className="size-4.5" />
          {unreadCount > 0 ? (
            <span className="absolute right-1 top-1 flex size-2 rounded-full bg-(--st-rejected-fg)" />
          ) : null}
        </Link>
      </header>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-(--surface) shadow-[var(--shadow-lg)]">
            <div className="flex items-center justify-between border-b border-(--border) px-4 py-4">
              <span className="truncate text-[0.9375rem] font-semibold text-(--text)">{orgName}</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex size-8 items-center justify-center rounded-[var(--radius-sm)] text-(--text-muted) hover:bg-(--surface-sunken)"
              >
                <IconClose className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3">
              <NavList onNavigate={() => setDrawerOpen(false)} />
            </div>
            <UserMenu userName={userName} userRole={userRole} logoutAction={logoutAction} unreadCount={unreadCount} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Desktop top bar */}
        <div className="hidden items-center justify-end border-b border-(--border) bg-(--surface) px-6 py-3 md:flex">
          <Link
            href="/notifications"
            aria-label="Notifications"
            className="relative flex size-9 items-center justify-center rounded-[var(--radius-sm)] text-(--text-muted) hover:bg-(--surface-sunken) hover:text-(--text)"
          >
            <IconBell className="size-4.5" />
            {unreadCount > 0 ? (
              <span className="absolute right-2 top-2 flex min-w-3.5 items-center justify-center rounded-full bg-(--st-rejected-fg) px-1 text-[0.625rem] font-semibold leading-3.5 text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Link>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>

      {menuOpen ? <div className="fixed inset-0 z-30" onClick={() => setMenuOpen(false)} /> : null}
    </div>
  );
}

function UserMenu({
  userName,
  userRole,
  logoutAction,
  unreadCount,
}: {
  userName: string;
  userRole: ShellUser["role"];
  logoutAction?: () => void | Promise<void>;
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative border-t border-(--border) p-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2.5 rounded-[var(--radius-sm)] px-2 py-2 text-left hover:bg-(--surface-sunken)"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-(--surface-sunken) text-[0.8125rem] font-semibold text-(--text)">
          {initial}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.8125rem] font-medium text-(--text)">{userName}</span>
          <span className="block text-[0.6875rem] text-(--text-faint)">
            {userRole === "org_admin" ? "Organization admin" : "Member"}
          </span>
        </span>
        <IconChevronDown className={`size-3.5 shrink-0 text-(--text-faint) transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="absolute bottom-full left-2 right-2 z-40 mb-1 overflow-hidden rounded-[var(--radius-md)] border border-(--border) bg-(--surface-raised) shadow-[var(--shadow-md)]">
          <Link href="/profile" onClick={() => setOpen(false)} className="block px-3.5 py-2.5 text-[0.8125rem] text-(--text) hover:bg-(--surface-sunken)">
            Profile &amp; password
          </Link>
          <Link href="/delegations" onClick={() => setOpen(false)} className="block px-3.5 py-2.5 text-[0.8125rem] text-(--text) hover:bg-(--surface-sunken)">
            Delegations
          </Link>
          <Link href="/notifications" onClick={() => setOpen(false)} className="flex items-center justify-between px-3.5 py-2.5 text-[0.8125rem] text-(--text) hover:bg-(--surface-sunken)">
            Notifications
            {unreadCount > 0 ? <span className="text-(--text-faint)">{unreadCount} unread</span> : null}
          </Link>
          <form action={logoutAction} className="border-t border-(--border)">
            <button type="submit" className="block w-full px-3.5 py-2.5 text-left text-[0.8125rem] text-(--st-rejected-fg) hover:bg-(--surface-sunken)">
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
