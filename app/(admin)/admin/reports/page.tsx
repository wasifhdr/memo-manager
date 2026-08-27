import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { memoReport } from '@/lib/repo/reports'
import { listDepartments, listCategories } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { StatTile } from '@/components/dashboard/stat-tile'
import { Select, Input, Label } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/badge'
import type { MemoStatus } from '@/db/schema'

export const metadata: Metadata = { title: 'Reports' }

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' }, { value: 'submitted', label: 'Submitted' },
  { value: 'pending_review', label: 'Pending review' }, { value: 'pending_approval', label: 'Pending approval' },
  { value: 'changes_requested', label: 'Changes requested' }, { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' }, { value: 'cancelled', label: 'Cancelled' },
]

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; departmentId?: string; categoryId?: string; status?: string }>
}) {
  const ctx = await requireAdmin()
  const sp = await searchParams

  const [departments, categories] = await Promise.all([
    listDepartments(ctx, { activeOnly: true }),
    listCategories(ctx, { activeOnly: true }),
  ])

  const filters = {
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    departmentId: sp.departmentId || undefined,
    categoryId: sp.categoryId || undefined,
    status: STATUS_OPTIONS.some((o) => o.value === sp.status) ? (sp.status as MemoStatus) : undefined,
  }
  const report = await memoReport(ctx, filters)
  const hasFilter = Object.values(sp).some((v) => v)

  function searchHref(extra: Record<string, string>) {
    const params = new URLSearchParams()
    if (sp.from) params.set('from', sp.from)
    if (sp.to) params.set('to', sp.to)
    for (const [k, v] of Object.entries(extra)) params.set(k, v)
    return `/search?${params.toString()}`
  }

  return (
    <div>
      <PageHeader title="Reports" description="Organization-wide memo statistics." />

      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={sp.from} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={sp.to} />
        </div>
        <div>
          <Label htmlFor="departmentId">Department</Label>
          <Select id="departmentId" name="departmentId" defaultValue={sp.departmentId ?? ''} placeholder="Any"
            options={departments.map((d) => ({ value: d.id, label: d.name }))} className="w-44" />
        </div>
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" defaultValue={sp.categoryId ?? ''} placeholder="Any"
            options={categories.map((c) => ({ value: c.id, label: c.name }))} className="w-44" />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={sp.status ?? ''} placeholder="Any" options={STATUS_OPTIONS} className="w-44" />
        </div>
        <Button type="submit" variant="secondary" size="sm">Apply</Button>
        {hasFilter ? <a href="/admin/reports" className="text-[0.8125rem] text-(--text-faint) hover:text-(--text-muted)">Clear</a> : null}
      </form>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Urgent memos" value={report.urgentCount} tone="urgent" />
        <StatTile label="Pending approvals" value={report.pendingApprovals} />
        <StatTile label="Rejected" value={report.rejectedCount} />
        <StatTile label="Change requests" value={report.changeRequestCount} />
        <div className="col-span-2 rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) px-4 py-3.5 sm:col-span-4">
          <p className="font-mono-nums text-2xl font-semibold text-(--text)">
            {report.avgCompletionHours != null ? `${report.avgCompletionHours.toFixed(1)}h` : '—'}
          </p>
          <p className="mt-0.5 text-[0.75rem] text-(--text-faint)">Average workflow completion time</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader><h2 className="text-sm font-semibold">By status</h2></CardHeader>
          <CardBody>
            <dl className="flex flex-col gap-2 text-[0.8125rem]">
              {report.byStatus.map((r) => (
                <a key={r.status} href={searchHref({ status: r.status })} className="flex items-center justify-between hover:text-(--accent)">
                  <StatusBadge status={r.status} />
                  <span className="font-mono-nums font-medium">{r.count}</span>
                </a>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold">By department</h2></CardHeader>
          <CardBody>
            <dl className="flex flex-col gap-2 text-[0.8125rem]">
              {report.byDepartment.map((r) => (
                <div key={r.department} className="flex items-center justify-between">
                  <dt className="text-(--text-muted)">{r.department}</dt>
                  <dd className="font-mono-nums font-medium text-(--text)">{r.count}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><h2 className="text-sm font-semibold">By category</h2></CardHeader>
          <CardBody>
            <dl className="flex flex-col gap-2 text-[0.8125rem]">
              {report.byCategory.map((r) => (
                <div key={r.category} className="flex items-center justify-between">
                  <dt className="text-(--text-muted)">{r.category}</dt>
                  <dd className="font-mono-nums font-medium text-(--text)">{r.count}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
