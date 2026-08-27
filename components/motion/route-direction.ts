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
let pending: Direction = 1;

export function setDirection(d: Direction) {
  pending = d;
}

/** Reads the direction for the incoming page and resets to the default. */
export function consumeDirection(): Direction {
  const d = pending;
  pending = 1;
  return d;
}
