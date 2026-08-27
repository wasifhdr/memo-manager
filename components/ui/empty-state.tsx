import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-lg)] border border-dashed border-(--border-strong) px-6 py-14 text-center">
      <p className="text-sm font-medium text-(--text)">{title}</p>
      {description ? <p className="max-w-sm text-[0.8125rem] text-(--text-muted)">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
