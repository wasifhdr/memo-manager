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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-2 flex flex-wrap items-center gap-2 text-label uppercase text-(--color-orange-deep)">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-h1 break-words text-(--color-ink)">{title}</h1>
        {description ? <p className="mt-1 text-sm text-(--color-ink)/70">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
