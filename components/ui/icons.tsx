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
