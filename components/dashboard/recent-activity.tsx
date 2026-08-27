import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/format'

export function RecentActivity({
  items,
}: {
  items: { id: string; description: string; actorName: string | null; createdAt: Date | string }[]
}) {
  if (items.length === 0) return <EmptyState title="No recent activity" description="Activity from the last 30 days will appear here." />
  return (
    <ul className="flex flex-col divide-y divide-(--border)">
      {items.map((a) => (
        <li key={a.id} className="flex items-baseline justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
          <span className="min-w-0 truncate text-[0.8125rem] text-(--text)">
            {a.actorName ? <span className="font-medium">{a.actorName}: </span> : null}
            {a.description}
          </span>
          <span className="shrink-0 font-mono-nums text-[0.6875rem] text-(--text-faint)">{formatDateTime(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  )
}
