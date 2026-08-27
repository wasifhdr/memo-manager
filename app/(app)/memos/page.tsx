import type { Metadata } from 'next'
import { requireSession } from '@/lib/tenant'
import { listMyMemos } from '@/lib/repo/memo'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { LinkButton } from '@/components/ui/button'
import { ListFilters, STATUS_OPTIONS } from '@/components/memo/list-filters'
import { formatDate } from '@/lib/format'
import type { MemoStatus } from '@/db/schema'

export const metadata: Metadata = { title: 'My Memos' }

type Row = Awaited<ReturnType<typeof listMyMemos>>['rows'][number]

const columns: Column<Row>[] = [
  { key: 'number', header: 'Memo #', render: (r) => <span className="font-mono-nums text-(--color-ink)/70">{r.memoNumber}</span> },
  { key: 'subject', header: 'Subject', render: (r) => <span className="font-medium">{r.subject}</span> },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'participant', header: 'Current participant', render: (r) => r.currentParticipantName ?? '—' },
  { key: 'priority', header: 'Priority', render: (r) => <PriorityBadge priority={r.priority} /> },
  { key: 'submitted', header: 'Submitted', render: (r) => formatDate(r.submittedAt) },
  { key: 'activity', header: 'Last activity', render: (r) => formatDate(r.lastActivityAt) },
]

export default async function MyMemosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  const ctx = await requireSession()
  const { status } = await searchParams
  const statusFilter = STATUS_OPTIONS.some((o) => o.value === status) ? (status as MemoStatus) : undefined

  const { rows, total } = await listMyMemos(ctx, { status: statusFilter, pageSize: 50 })

  return (
    <div>
      <PageHeader
        title="My Memos"
        description={`${total} memo${total === 1 ? '' : 's'} you have created.`}
        actions={<LinkButton href="/memos/new">New memo</LinkButton>}
      />
      <ListFilters action="/memos" statusOptions={STATUS_OPTIONS} current={{ status }} />
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        onRowHref={(r) => (r.status === 'draft' ? `/memos/${r.id}/edit` : `/memos/${r.id}`)}
        emptyTitle="No memos yet"
        emptyDescription="Create your first memo to get started."
      />
    </div>
  )
}
