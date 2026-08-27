import type { Metadata } from 'next'
import { requireSession } from '@/lib/tenant'
import { listInbox } from '@/lib/repo/memo'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { PriorityBadge } from '@/components/ui/badge'
import { ListFilters, PRIORITY_OPTIONS } from '@/components/memo/list-filters'
import { formatAge } from '@/lib/format'
import type { Priority } from '@/db/schema'

export const metadata: Metadata = { title: 'Inbox' }

type Row = Awaited<ReturnType<typeof listInbox>>['rows'][number]

const columns: Column<Row>[] = [
  { key: 'number', header: 'Memo #', render: (r) => <span className="font-mono-nums text-(--text-muted)">{r.memoNumber}</span> },
  { key: 'subject', header: 'Subject', render: (r) => <span className="font-medium">{r.subject}</span> },
  { key: 'sender', header: 'Sender', render: (r) => r.authorName },
  { key: 'department', header: 'Department', render: (r) => r.departmentName ?? '—' },
  { key: 'priority', header: 'Priority', render: (r) => <PriorityBadge priority={r.priority} /> },
  { key: 'action', header: 'Required action', render: (r) => (r.requiredAction === 'review' ? 'Review' : 'Approve') },
  { key: 'age', header: 'Age', align: 'right', render: (r) => <span className="font-mono-nums text-(--text-faint)">{formatAge(r.submittedAt)}</span> },
]

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ priority?: string }>
}) {
  const ctx = await requireSession()
  const { priority } = await searchParams
  const priorityFilter = (['normal', 'high', 'urgent'] as const).includes(priority as Priority) ? (priority as Priority) : undefined

  const { rows, total } = await listInbox(ctx, { priority: priorityFilter, pageSize: 50 })

  return (
    <div>
      <PageHeader
        title="Inbox"
        description={`${total} memo${total === 1 ? '' : 's'} awaiting your action.`}
      />
      <ListFilters action="/inbox" priorityOptions={PRIORITY_OPTIONS} current={{ priority }} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowHref={(r) => `/memos/${r.id}`}
        emptyTitle="Nothing is waiting on you"
        emptyDescription="Memos assigned to you for review or approval will appear here."
      />
    </div>
  )
}
