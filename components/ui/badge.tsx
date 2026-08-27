import type { HTMLAttributes } from "react";
import type { MemoStatus, Priority } from "@/db/schema";
import {
  IconCircleDashed, IconClock, IconEdit, IconXCircle, IconCheckCircle,
  IconSlashCircle, IconChevronsUp, IconFlame,
} from "@/components/ui/icons";

export function Badge({
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-(--border) bg-(--surface-sunken) px-2.5 py-1 text-[0.75rem] font-medium text-(--text-muted) ${className}`}
      {...props}
    />
  );
}

const STATUS_META: Record<
  MemoStatus,
  { label: string; bg: string; fg: string; Icon: typeof IconClock; dashed?: boolean }
> = {
  draft: { label: "Draft", bg: "var(--st-draft-bg)", fg: "var(--st-draft-fg)", Icon: IconCircleDashed },
  submitted: { label: "Submitted", bg: "var(--st-pending-bg)", fg: "var(--st-pending-fg)", Icon: IconClock },
  pending_review: { label: "Pending review", bg: "var(--st-pending-bg)", fg: "var(--st-pending-fg)", Icon: IconClock },
  pending_approval: { label: "Pending approval", bg: "var(--st-pending-bg)", fg: "var(--st-pending-fg)", Icon: IconClock },
  changes_requested: { label: "Changes requested", bg: "var(--st-changes-bg)", fg: "var(--st-changes-fg)", Icon: IconEdit },
  rejected: { label: "Rejected", bg: "var(--st-rejected-bg)", fg: "var(--st-rejected-fg)", Icon: IconXCircle },
  approved: { label: "Approved", bg: "var(--st-approved-bg)", fg: "var(--st-approved-fg)", Icon: IconCheckCircle },
  cancelled: { label: "Cancelled", bg: "var(--st-cancelled-bg)", fg: "var(--st-cancelled-fg)", Icon: IconSlashCircle, dashed: true },
};

/**
 * Memo lifecycle status. Pill badge, icon + word — the "status" visual
 * channel. Never share a hue with PriorityBadge; see app/globals.css.
 */
export function StatusBadge({ status, className = "" }: { status: MemoStatus; className?: string }) {
  const m = STATUS_META[status];
  const Icon = m.Icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.75rem] font-medium ${className}`}
      style={{ background: m.bg, color: m.fg }}
    >
      <Icon className="size-3.5 shrink-0" />
      {m.label}
    </span>
  );
}

const PRIORITY_META: Record<Priority, { label: string } | null> = {
  normal: null,
  high: { label: "High" },
  urgent: { label: "Urgent" },
};

/**
 * Memo urgency. A square-cornered tag, distinct in shape AND hue family
 * (violet/magenta) from StatusBadge's rounded green/blue/amber/red pills —
 * so status and priority never compete for the same read.
 */
export function PriorityBadge({ priority, className = "" }: { priority: Priority; className?: string }) {
  const m = PRIORITY_META[priority];
  if (!m) return null;
  const isUrgent = priority === "urgent";
  const Icon = isUrgent ? IconFlame : IconChevronsUp;
  const bg = isUrgent ? "var(--pr-urgent-bg)" : "var(--pr-high-bg)";
  const fg = isUrgent ? "var(--pr-urgent-fg)" : "var(--pr-high-fg)";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[0.25rem] px-2 py-0.5 text-[0.75rem] font-semibold ${className}`}
      style={{ background: bg, color: fg }}
    >
      <Icon className="size-3" />
      {m.label}
    </span>
  );
}
