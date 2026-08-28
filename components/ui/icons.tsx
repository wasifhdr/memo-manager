import type { SVGProps } from "react";

/**
 * Hand-authored icon set, one stroke grammar throughout: 1.75px stroke,
 * round caps/joins, 16x16 viewbox, no fill. Kept intentionally small —
 * only the glyphs the memo lifecycle actually needs.
 */
const base: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.75,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export function IconCircleDashed(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="5.5" strokeDasharray="2.6 2.6" />
    </svg>
  );
}

export function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.2l2.2 1.3" />
    </svg>
  );
}

export function IconEdit(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M10.6 2.9a1.3 1.3 0 0 1 1.9 1.9L5.4 11.9l-2.6.7.7-2.6z" />
    </svg>
  );
}

export function IconXCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M6.2 6.2l3.6 3.6M9.8 6.2l-3.6 3.6" />
    </svg>
  );
}

export function IconCheckCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.6 8.2l1.7 1.7 3.1-3.6" />
    </svg>
  );
}

export function IconSlashCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M4.9 11.1l6.2-6.2" />
    </svg>
  );
}

export function IconChevronsUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4.5 8.8L8 5.3l3.5 3.5" />
      <path d="M4.5 11.8L8 8.3l3.5 3.5" />
    </svg>
  );
}

export function IconFlame(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.5c.3 2 2.6 2.9 2.6 5.4a2.6 2.6 0 1 1-5.2 0c0-.7.3-1.2.7-1.7-.1.7.1 1.2.6 1.4-.2-1.7 1-2 1.3-3.7z" />
    </svg>
  );
}

export function IconBell(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.6c1.7 0 3 1.4 3 3.1v2c0 .9.3 1.7.9 2.4l.3.4H3.8l.3-.4c.6-.7.9-1.5.9-2.4v-2c0-1.7 1.3-3.1 3-3.1z" />
      <path d="M6.4 12.4a1.6 1.6 0 0 0 3.2 0" />
    </svg>
  );
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export function IconClose(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function IconMenu(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
    </svg>
  );
}

export function IconPaperclip(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M11.5 6.3L6.8 11a2.2 2.2 0 0 1-3.1-3.1l5.3-5.3a1.5 1.5 0 1 1 2.1 2.1L6 9.8a.8.8 0 1 1-1.1-1.1l4.2-4.2" />
    </svg>
  );
}

export function IconUsers(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="6.2" cy="6" r="2.4" />
      <path d="M2.2 13.4c0-2.2 1.8-3.5 4-3.5s4 1.3 4 3.5" />
      <path d="M10.7 4.2a2.3 2.3 0 0 1 0 4.2" />
      <path d="M11.5 10c1.5.4 2.5 1.5 2.5 3.4" />
    </svg>
  );
}

export function IconBuilding(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3.4 13.5V3.5a.9.9 0 0 1 .9-.9h4.6a.9.9 0 0 1 .9.9v10" />
      <path d="M9.8 6.8h1.9a.9.9 0 0 1 .9.9v5.8" />
      <path d="M5.5 5.5h2M5.5 7.9h2M5.5 10.3h2M2.2 13.5h11.6" />
    </svg>
  );
}

export function IconDocument(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M4.2 2.6h4.1L11.8 6v7.4a.9.9 0 0 1-.9.9H4.2a.9.9 0 0 1-.9-.9V3.5a.9.9 0 0 1 .9-.9z" />
      <path d="M8.2 2.7v3.4h3.5" />
      <path d="M5.6 9.3h4.1M5.6 11.5h3" />
    </svg>
  );
}

export function IconCheck(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M3.3 8.4l3.2 3.2 6.2-7" />
    </svg>
  );
}

export function IconGrid(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <rect x="2.6" y="2.6" width="4.6" height="4.6" rx="1.1" />
      <rect x="8.8" y="2.6" width="4.6" height="4.6" rx="1.1" />
      <rect x="2.6" y="8.8" width="4.6" height="4.6" rx="1.1" />
      <rect x="8.8" y="8.8" width="4.6" height="4.6" rx="1.1" />
    </svg>
  );
}

export function IconInbox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2.4 9.4L4 3.5a1 1 0 0 1 1-.7h6a1 1 0 0 1 1 .7l1.6 5.9" />
      <path d="M2.4 9.4v2.7a1.1 1.1 0 0 0 1.1 1.1h9a1.1 1.1 0 0 0 1.1-1.1V9.4h-3.4a2.2 2.2 0 0 1-4.4 0z" />
    </svg>
  );
}

export function IconSearch(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="7.2" cy="7.2" r="4.3" />
      <path d="M10.4 10.4l3 3" />
    </svg>
  );
}

export function IconSettings(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="8" r="2.1" />
      <path d="M12.6 9.8a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 1 1-1.7 1.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.2a1.2 1.2 0 0 1-2.4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 1 1-1.7-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2a1.2 1.2 0 0 1 0-2.4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 1 1 1.7-1.7l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9v-.2a1.2 1.2 0 0 1 2.4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 1 1 1.7 1.7l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a1.2 1.2 0 0 1 0 2.4h-.1a1 1 0 0 0-.9.6z" />
    </svg>
  );
}

export function IconLogout(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6.2 13.4H3.9a1.1 1.1 0 0 1-1.1-1.1V3.7a1.1 1.1 0 0 1 1.1-1.1h2.3" />
      <path d="M10.2 11.2L13.4 8l-3.2-3.2" />
      <path d="M13.4 8H6.2" />
    </svg>
  );
}

export function IconUser(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <circle cx="8" cy="5.6" r="2.7" />
      <path d="M3 13.4c0-2.5 2.2-4 5-4s5 1.5 5 4" />
    </svg>
  );
}

export function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M7.4 2.7H3.6a.9.9 0 0 0-.9.9v3.8c0 .24.1.47.27.64l5.2 5.2a.9.9 0 0 0 1.28 0l3.8-3.8a.9.9 0 0 0 0-1.28l-5.2-5.2a.9.9 0 0 0-.64-.26z" />
      <path d="M5.6 5.6h.01" />
    </svg>
  );
}

export function IconChart(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M2.8 13.2h10.4" />
      <path d="M4.7 13.2V7.4M8 13.2V3.6M11.3 13.2V9.6" />
    </svg>
  );
}

export function IconChevronLeft(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M10 4l-4 4 4 4" />
    </svg>
  );
}

export function IconShield(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M8 2.3l4.4 1.8v3.5c0 2.7-1.8 4.8-4.4 5.9-2.6-1.1-4.4-3.2-4.4-5.9V4.1z" />
      <path d="M6.2 7.9l1.3 1.3 2.4-2.7" />
    </svg>
  );
}

export function IconEye(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M1.6 8s2.4-4.3 6.4-4.3S14.4 8 14.4 8s-2.4 4.3-6.4 4.3S1.6 8 1.6 8z" />
      <circle cx="8" cy="8" r="1.9" />
    </svg>
  );
}

export function IconEyeOff(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...base} {...props}>
      <path d="M6.4 4a6.6 6.6 0 0 1 1.6-.2c4 0 6.4 4.2 6.4 4.2a11 11 0 0 1-1.9 2.4" />
      <path d="M4.1 5.2A11 11 0 0 0 1.6 8s2.4 4.3 6.4 4.3c1 0 1.9-.3 2.7-.7" />
      <path d="M6.7 6.7a1.9 1.9 0 0 0 2.6 2.6" />
      <path d="M2.6 2.6l10.8 10.8" />
    </svg>
  );
}
