import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { listAudit, listAuditEventTypes } from '@/lib/repo/audit'
import { listUsers } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Select, Input, Label } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'

export const metadata: Metadata = { title: 'Audit Log' }

type Row = Awaited<ReturnType<typeof listAudit>>['rows'][number]

const columns: Column<Row>[] = [
  { key: 'when', header: 'When', render: (r) => <span className="font-mono-nums text-(--color-ink)/70">{formatDateTime(r.createdAt)}</span> },
  { key: 'actor', header: 'Actor', render: (r) => r.actorName ?? 'System' },
  { key: 'event', header: 'Event', render: (r) => <span className="font-mono-nums text-[0.75rem]">{r.eventType}</span> },
  { key: 'description', header: 'Description', render: (r) => r.description },
]

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{ eventType?: string; actorId?: string; from?: string; to?: string }>
}) {
  const ctx = await requireAdmin()
  const sp = await searchParams

  const [eventTypes, orgUsers] = await Promise.all([listAuditEventTypes(ctx), listUsers(ctx)])

  const { rows, total } = await listAudit(ctx, {
    eventType: sp.eventType || undefined,
    actorId: sp.actorId || undefined,
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    pageSize: 100,
  })

  const hasFilter = !!(sp.eventType || sp.actorId || sp.from || sp.to)

  return (
    <div>
      <PageHeader title="Audit Log" description={`${total} recorded event${total === 1 ? '' : 's'} for your organization. Read-only.`} />

      <form method="get" className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="eventType">Event type</Label>
          <Select id="eventType" name="eventType" defaultValue={sp.eventType ?? ''} placeholder="Any"
            options={eventTypes.map((t) => ({ value: t, label: t }))} className="w-56" />
        </div>
        <div>
          <Label htmlFor="actorId">Actor</Label>
          <Select id="actorId" name="actorId" defaultValue={sp.actorId ?? ''} placeholder="Any"
            options={orgUsers.map((u) => ({ value: u.id, label: u.name }))} className="w-48" />
        </div>
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={sp.from} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={sp.to} />
        </div>
        <Button type="submit" variant="secondary" size="sm">Filter</Button>
        {hasFilter ? <a href="/admin/audit" className="text-[0.8125rem] text-(--color-ink)/50 hover:text-(--color-ink)/70">Clear</a> : null}
      </form>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        emptyTitle="No audit records"
        emptyDescription="Significant system events for your organization will appear here."
      />
    </div>
  )
}
