import Link from 'next/link'
import { StatusBadge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { MemoStatus } from '@/db/schema'

export function MiniMemoList({
  items, emptyText,
}: {
  items: { id: string; memoNumber: string; subject: string; status?: MemoStatus; caption?: string | null }[]
  emptyText: string
}) {
  if (items.length === 0) return <EmptyState title={emptyText} />
  return (
    <ul className="flex flex-col divide-y divide-(--color-sand)">
      {items.map((m) => (
        <li key={m.id}>
          <Link
            href={`/memos/${m.id}`}
            className="flex items-start justify-between gap-3 py-2.5 first:pt-0 last:pb-0 hover:text-(--color-orange-deep)"
          >
            <span className="min-w-0">
              {/* two lines rather than a hard single-line truncate — a memo
                  subject cut at ~20 characters is not identifiable */}
              <span className="line-clamp-2 text-[0.8125rem] font-bold text-(--color-ink)">{m.subject}</span>
              <span className="mt-0.5 block font-mono-nums text-[0.75rem] text-(--color-ink)/50">
                {m.memoNumber}{m.caption ? ` · ${m.caption}` : ''}
              </span>
            </span>
            {m.status ? <StatusBadge status={m.status} className="mt-0.5 shrink-0" /> : null}
          </Link>
        </li>
      ))}
    </ul>
  )
}
