import { NAV, ADMIN_NAV } from "@/components/nav";

/** Sidebar order, top to bottom. Direction is derived from position in this list. */
const ROUTE_ORDER: string[] = [...NAV.map((n) => n.href), ...ADMIN_NAV.map((n) => n.href)];

export type Direction = 1 | -1;

function indexOf(pathname: string): number {
  // Longest match wins so /memos/<id> resolves to the /memos entry.
  let best = -1;
  let bestLen = -1;
  ROUTE_ORDER.forEach((href, i) => {
    const hit = pathname === href || pathname.startsWith(href + "/");
    if (hit && href.length > bestLen) { best = i; bestLen = href.length; }
  });
  return best;
}

/** +1 = moving down the sidebar, -1 = moving up. */
export function directionFor(from: string, to: string): Direction {
  const a = indexOf(from);
  const b = indexOf(to);
  if (a < 0 || b < 0 || a === b) return 1;
  return b > a ? 1 : -1;
}

// Module-scoped rather than React state: the value has to survive the unmount
// of the whole shell when navigating between the (app) and (admin) layouts.
let pending: { to: string; dir: Direction } | null = null;

/** Records the direction for the navigation about to happen. */
export function setDirection(to: string, dir: Direction) {
  pending = { to, dir };
}

/**
 * Direction for the page now entering.
 *
 * Deliberately idempotent — it reads the record instead of consuming it.
 * React invokes effects twice under Strict Mode (Next enables it in dev), and
 * a consume-once value handed the second invocation the default of +1, so
 * upward navigations animated downward: the new page entered from below and
 * travelled up into place instead of down.
 */
export function directionOnEnter(pathname: string): Direction {
  return pending && pending.to === pathname ? pending.dir : 1;
}
