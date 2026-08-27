import type { Metadata } from 'next'
import { requireSession } from '@/lib/tenant'
import { listNotifications } from '@/lib/repo/notifications'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { NotificationRow } from './notification-row'
import { markAllNotificationsReadAction } from './actions'
import { Button } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Notifications' }

export default async function NotificationsPage() {
  const ctx = await requireSession()
  const items = await listNotifications(ctx, { limit: 50 })
  const hasUnread = items.some((n) => !n.readAt)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Notifications"
        actions={
          hasUnread ? (
            <form action={markAllNotificationsReadAction}>
              <Button type="submit" variant="ghost" size="sm">Mark all read</Button>
            </form>
          ) : null
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No notifications yet" description="You'll see workflow updates, comments, and assignments here." />
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((n) => <NotificationRow key={n.id} n={n} />)}
        </ul>
      )}
    </div>
  )
}
