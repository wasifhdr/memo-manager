import type { Metadata } from 'next'
import { requireSession } from '@/lib/tenant'
import { listCompleted } from '@/lib/repo/memo'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { ListFilters, STATUS_OPTIONS } from '@/components/memo/list-filters'
import { formatDate } from '@/lib/format'
import type { MemoStatus } from '@/db/schema'

export const metadata: Metadata = { title: 'Completed Memos' }

const COMPLETED_STATUS_OPTIONS = STATUS_OPTIONS.filter((o) =>
  ['approved', 'rejected', 'cancelled'].includes(o.value),
)

type Row = Awaited<ReturnType<typeof listCompleted>>['rows'][number]

const columns: Column<Row>[] = [
  { key: 'number', header: 'Memo #', render: (r) => <span className="font-mono-nums text-(--text-muted)">{r.memoNumber}</span> },
  { key: 'subject', header: 'Subject', render: (r) => <span className="font-medium">{r.subject}</span> },
  { key: 'author', header: 'Author', render: (r) => r.authorName },
  { key: 'department', header: 'Department', render: (r) => r.departmentName ?? '—' },
  { key: 'priority', header: 'Priority', render: (r) => <PriorityBadge priority={r.priority} /> },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'completed', header: 'Completed', render: (r) => formatDate(r.completedAt) },
]

export default async function CompletedPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const ctx = await requireSession()
  const { status } = await searchParams
  const statusFilter = COMPLETED_STATUS_OPTIONS.some((o) => o.value === status) ? (status as MemoStatus) : undefined

  const { rows, total } = await listCompleted(ctx, { status: statusFilter, pageSize: 50 })

  return (
    <div>
      <PageHeader title="Completed Memos" description={`${total} completed workflow${total === 1 ? '' : 's'} you can access.`} />
      <ListFilters action="/completed" statusOptions={COMPLETED_STATUS_OPTIONS} current={{ status }} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowHref={(r) => `/memos/${r.id}`}
        emptyTitle="No completed memos yet"
        emptyDescription="Approved, rejected and cancelled memos you're authorized to see will appear here."
      />
    </div>
  )
}
