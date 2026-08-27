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
    <div className="flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-(--color-sand) bg-(--color-cream)/50 px-6 py-14 text-center">
      <p className="text-h3 text-(--color-ink)">{title}</p>
      {description ? <p className="max-w-sm text-sm text-(--color-ink)/70">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
