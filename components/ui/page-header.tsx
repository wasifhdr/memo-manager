import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  /** A short reference — a memo number, a status — not a decorative kicker label. */
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-(--border) pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 flex flex-wrap items-center gap-2 font-mono-nums text-[0.75rem] text-(--text-faint)">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="truncate text-2xl font-semibold text-(--text) font-serif-heading">{title}</h1>
        {description ? <p className="mt-1 text-sm text-(--text-muted)">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
