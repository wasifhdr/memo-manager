import type { ReactNode } from "react";
import { EmptyState } from "@/components/ui/empty-state";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
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

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-(--border) bg-(--surface)">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-(--border) bg-(--surface-sunken)">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`whitespace-nowrap px-4 py-2.5 text-[0.75rem] font-semibold uppercase tracking-wide text-(--text-faint) ${alignClass[col.align ?? "left"]} ${col.headerClassName ?? ""}`}
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
                className="border-b border-(--border) last:border-b-0 transition-colors hover:bg-(--surface-sunken)"
              >
                {columns.map((col, i) => (
                  <td
                    key={col.key}
                    className={`px-4 py-3 align-middle text-(--text) ${href && i === 0 ? "relative" : ""} ${alignClass[col.align ?? "left"]} ${col.className ?? ""}`}
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
  );
}
