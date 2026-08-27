import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  /** Becomes the card heading in the mobile layout. Defaults to the `subject`
   * column when there is one, otherwise the first column. */
  primary?: boolean;
  /** Omit from the mobile card (noise that only earns its place in a table). */
  hideOnMobile?: boolean;
};

const alignClass: Record<NonNullable<Column<unknown>["align"]>, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  onRowHref,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowHref?: (row: T) => string | undefined;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  const primary =
    columns.find((c) => c.primary) ?? columns.find((c) => c.key === "subject") ?? columns[0];
  const secondary = columns.filter((c) => c !== primary && !c.hideOnMobile);

  return (
    <>
      {/* Mobile: one card per row. A 36rem table on a ~400px screen is a
          side-scrolling mess, so the same data stacks instead. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => {
          const href = onRowHref?.(row);
          const inner = (
            <>
              <div className="mb-2 text-[0.9375rem] font-bold text-(--color-ink)">
                {primary.render(row)}
              </div>
              <dl className="flex flex-col gap-1.5">
                {secondary.map((col) => (
                  <div key={col.key} className="flex items-baseline justify-between gap-3">
                    <dt className="shrink-0 text-label uppercase text-(--color-ink)/50">{col.header}</dt>
                    <dd className="min-w-0 text-right text-[0.8125rem] text-(--color-ink)">{col.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </>
          );

          return (
            <li key={rowKey(row)}>
              {href ? (
                // the whole card is the tap target — no absolute overlay to fight
                <a
                  href={href}
                  className="block rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) p-3.5 transition-colors active:bg-(--color-cream)"
                >
                  {inner}
                </a>
              ) : (
                <div className="rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) p-3.5">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Desktop: the table proper. */}
      <div className="hidden overflow-x-auto rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper) md:block">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`whitespace-nowrap border-b-2 border-(--color-ink) px-3 py-2 text-label uppercase text-(--color-ink)/60 ${alignClass[col.align ?? "left"]} ${col.headerClassName ?? ""}`}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href = onRowHref?.(row);
              return (
                <tr
                  key={rowKey(row)}
                  className="border-b border-(--color-sand) last:border-b-0 transition-colors hover:bg-(--color-cream)/60"
                >
                  {columns.map((col, i) => (
                    <td
                      key={col.key}
                      className={`px-3 py-2.5 align-middle text-(--color-ink) ${href && i === 0 ? "relative" : ""} ${alignClass[col.align ?? "left"]} ${col.className ?? ""}`}
                    >
                      {href && i === 0 ? (
                        <a href={href} className="absolute inset-0" aria-label="Open" />
                      ) : null}
                      <span className="relative">{col.render(row)}</span>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
