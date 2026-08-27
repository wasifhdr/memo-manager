import { EmptyState } from '@/components/ui/empty-state'
import { formatDateTime } from '@/lib/format'

export function RecentActivity({
  items,
}: {
  items: { id: string; description: string; actorName: string | null; createdAt: Date | string }[]
}) {
  if (items.length === 0) return <EmptyState title="No recent activity" description="Activity from the last 30 days will appear here." />
  return (
    <ul className="flex flex-col divide-y divide-(--color-sand)">
      {items.map((a) => (
        <li
          key={a.id}
          // Stacked on a phone: a fixed-width timestamp beside truncated text
          // left roughly 160px for the description, which cut it to nothing
          // ("karim@nbu…"). Side-by-side only once there is room for it.
          className="flex flex-col gap-0.5 py-2.5 first:pt-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
        >
          <span className="min-w-0 text-[0.8125rem] text-(--color-ink) sm:truncate">
            {a.actorName ? <span className="font-bold">{a.actorName}: </span> : null}
            {a.description}
          </span>
          <span className="shrink-0 font-mono-nums text-[0.6875rem] text-(--color-ink)/50">
            {formatDateTime(a.createdAt)}
          </span>
        </li>
      ))}
    </ul>
  )
}
