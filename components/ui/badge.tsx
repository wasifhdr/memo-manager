import type { HTMLAttributes } from "react";
import type { MemoStatus, Priority } from "@/db/schema";
import {
  IconCircleDashed, IconClock, IconEdit, IconXCircle, IconCheckCircle,
  IconSlashCircle, IconChevronsUp, IconFlame,
} from "@/components/ui/icons";

const badgeTones = {
  neutral: "border-(--color-sand) bg-(--color-cream) text-(--color-ink)/70",
  success: "border-(--color-green)/40 bg-(--color-green)/10 text-(--color-green-deep)",
  pending: "border-(--color-gold)/50 bg-(--color-gold)/15 text-(--color-gold-deep)",
  failed: "border-(--color-red)/40 bg-(--color-red)/10 text-(--color-red-deep)",
  info: "border-(--color-blue)/40 bg-(--color-blue)/10 text-(--color-blue-deep)",
  purple: "border-(--color-purple)/40 bg-(--color-purple)/10 text-(--color-purple-deep)",
} as const;

export function Badge({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-label uppercase ${badgeTones.neutral} ${className}`}
      {...props}
    />
  );
}

// The design contract's semantic palette has five status hues to work with
// (orange is reserved for the screen's one primary action). Every memo
// status maps onto exactly one, per §2.1: success/pending/failed/info/neutral.
const STATUS_META: Record<
  MemoStatus,
  { label: string; tone: keyof typeof badgeTones; Icon: typeof IconClock }
> = {
  draft: { label: "Draft", tone: "neutral", Icon: IconCircleDashed },
  submitted: { label: "Submitted", tone: "info", Icon: IconClock },
  pending_review: { label: "Pending review", tone: "info", Icon: IconClock },
  pending_approval: { label: "Pending approval", tone: "info", Icon: IconClock },
  changes_requested: { label: "Changes requested", tone: "pending", Icon: IconEdit },
  rejected: { label: "Rejected", tone: "failed", Icon: IconXCircle },
  approved: { label: "Approved", tone: "success", Icon: IconCheckCircle },
  cancelled: { label: "Cancelled", tone: "neutral", Icon: IconSlashCircle },
};

/** Memo lifecycle status. Filled pill, per the Badge recipe in D:/DESIGN.md §5. */
export function StatusBadge({ status, className = "" }: { status: MemoStatus; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border px-2.5 py-0.5 text-label uppercase ${badgeTones[m.tone]} ${className}`}
    >
      <Icon className="size-3.5 shrink-0" />
      {m.label}
    </span>
  );
}

const PRIORITY_META: Record<Priority, { label: string; tone: "high" | "urgent" } | null> = {
  normal: null,
  high: { label: "High", tone: "high" },
  urgent: { label: "Urgent", tone: "urgent" },
};

/**
 * Memo urgency. Every filled-pill hue is already claimed by StatusBadge, so
 * priority reads through a different device entirely — a plain inline
 * icon+label, no fill or border — rather than competing for the same
 * five-hue channel. Urgent additionally carries the design system's own
 * "live/recording indicator" pulse (§5 Badge), repurposed here as "needs
 * attention now".
 */
export function PriorityBadge({ priority, className = "" }: { priority: Priority; className?: string }) {
  const m = PRIORITY_META[priority];
  if (!m) return null;
  const isUrgent = m.tone === "urgent";
  const Icon = isUrgent ? IconFlame : IconChevronsUp;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-bold ${isUrgent ? "text-(--color-red-deep)" : "text-(--color-ink)/70"} ${className}`}
    >
      {isUrgent ? <span className="size-1.5 rounded-[var(--radius-pill)] bg-(--color-red) animate-pulse" /> : null}
      <Icon className="size-3.5" />
      {m.label}
    </span>
  );
}
