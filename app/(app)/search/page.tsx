import type { Metadata } from 'next'
import { requireSession } from '@/lib/tenant'
import { searchMemos } from '@/lib/repo/search'
import { listDepartments, listCategories, listUsers } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { Input, Label, Select } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/format'
import type { MemoStatus, Priority } from '@/db/schema'

export const metadata: Metadata = { title: 'Search' }

type SearchParamsIn = {
  text?: string; memoNumber?: string; authorId?: string
  departmentId?: string; categoryId?: string; status?: string; priority?: string
  from?: string; to?: string
}

type Row = Awaited<ReturnType<typeof searchMemos>>['rows'][number]

const columns: Column<Row>[] = [
  { key: 'number', header: 'Memo #', render: (r) => <span className="font-mono-nums text-(--text-muted)">{r.memoNumber}</span> },
  { key: 'subject', header: 'Subject', render: (r) => <span className="font-medium">{r.subject}</span> },
  { key: 'author', header: 'Author', render: (r) => r.authorName },
  { key: 'department', header: 'Department', render: (r) => r.departmentName ?? '—' },
  { key: 'category', header: 'Category', render: (r) => r.categoryName ?? '—' },
  { key: 'priority', header: 'Priority', render: (r) => <PriorityBadge priority={r.priority} /> },
  { key: 'status', header: 'Status', render: (r) => <StatusBadge status={r.status} /> },
  { key: 'created', header: 'Created', render: (r) => formatDate(r.createdAt) },
]

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' }, { value: 'submitted', label: 'Submitted' },
  { value: 'pending_review', label: 'Pending review' }, { value: 'pending_approval', label: 'Pending approval' },
  { value: 'changes_requested', label: 'Changes requested' }, { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' }, { value: 'cancelled', label: 'Cancelled' },
]
const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' },
]

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsIn>
}) {
  const ctx = await requireSession()
  const sp = await searchParams
  const hasQuery = Object.values(sp).some((v) => v && v.trim())

  const [departments, categories, orgUsers] = await Promise.all([
    listDepartments(ctx, { activeOnly: true }),
    listCategories(ctx, { activeOnly: true }),
    listUsers(ctx),
  ])

  const result = hasQuery
    ? await searchMemos(ctx, {
        text: sp.text, memoNumber: sp.memoNumber, authorId: sp.authorId || undefined,
        departmentId: sp.departmentId || undefined, categoryId: sp.categoryId || undefined,
        status: STATUS_OPTIONS.some((o) => o.value === sp.status) ? (sp.status as MemoStatus) : undefined,
        priority: PRIORITY_OPTIONS.some((o) => o.value === sp.priority) ? (sp.priority as Priority) : undefined,
        from: sp.from ? new Date(sp.from) : undefined,
        to: sp.to ? new Date(sp.to) : undefined,
        pageSize: 50,
      })
    : null

  return (
    <div>
      <PageHeader title="Search" description="Search within your organization's memos." />

      <form method="get" className="mb-6 grid gap-4 rounded-[var(--radius-lg)] border border-(--border) bg-(--surface) p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <Label htmlFor="text">Keyword</Label>
          <Input id="text" name="text" defaultValue={sp.text} placeholder="Search subject and body…" />
        </div>
        <div>
          <Label htmlFor="memoNumber">Memo number</Label>
          <Input id="memoNumber" name="memoNumber" defaultValue={sp.memoNumber} />
        </div>
        <div>
          <Label htmlFor="authorId">Author</Label>
          <Select id="authorId" name="authorId" defaultValue={sp.authorId ?? ''} placeholder="Any"
            options={orgUsers.map((u) => ({ value: u.id, label: u.name }))} />
        </div>
        <div>
          <Label htmlFor="departmentId">Department</Label>
          <Select id="departmentId" name="departmentId" defaultValue={sp.departmentId ?? ''} placeholder="Any"
            options={departments.map((d) => ({ value: d.id, label: d.name }))} />
        </div>
        <div>
          <Label htmlFor="categoryId">Category</Label>
          <Select id="categoryId" name="categoryId" defaultValue={sp.categoryId ?? ''} placeholder="Any"
            options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        </div>
        <div>
          <Label htmlFor="status">Status</Label>
          <Select id="status" name="status" defaultValue={sp.status ?? ''} placeholder="Any" options={STATUS_OPTIONS} />
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Select id="priority" name="priority" defaultValue={sp.priority ?? ''} placeholder="Any" options={PRIORITY_OPTIONS} />
        </div>
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" name="from" type="date" defaultValue={sp.from} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" name="to" type="date" defaultValue={sp.to} />
        </div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Search</Button>
          {hasQuery ? <a href="/search" className="text-[0.8125rem] text-(--text-faint) hover:text-(--text-muted)">Clear</a> : null}
        </div>
      </form>

      {result ? (
        <DataTable
          columns={columns}
          rows={result.rows}
          rowKey={(r) => r.id}
          onRowHref={(r) => `/memos/${r.id}`}
          emptyTitle="No matching memos"
          emptyDescription="Try a different keyword or fewer filters."
        />
      ) : (
        <p className="text-[0.8125rem] text-(--text-faint)">Enter a keyword or choose a filter to search.</p>
      )}
    </div>
  )
}
