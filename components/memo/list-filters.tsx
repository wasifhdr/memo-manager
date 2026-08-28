import { Select } from '@/components/ui/field'
import { Button } from '@/components/ui/button'

type Option = { value: string; label: string }

/** A plain GET form — works with no JavaScript, keeps filters in the URL. */
export function ListFilters({
  action, statusOptions, priorityOptions, current,
}: {
  action: string
  statusOptions?: Option[]
  priorityOptions?: Option[]
  current: { status?: string; priority?: string }
}) {
  return (
    <form action={action} method="get" className="mb-4 flex flex-wrap items-end gap-3">
      {statusOptions ? (
        <div>
          <label className="mb-1.5 block text-label uppercase text-(--color-ink)/70" htmlFor="status">Status</label>
          <Select id="status" name="status" defaultValue={current.status ?? ''} placeholder="All statuses" options={statusOptions} className="w-48" searchable={false} />
        </div>
      ) : null}
      {priorityOptions ? (
        <div>
          <label className="mb-1.5 block text-label uppercase text-(--color-ink)/70" htmlFor="priority">Priority</label>
          <Select id="priority" name="priority" defaultValue={current.priority ?? ''} placeholder="All priorities" options={priorityOptions} className="w-40" />
        </div>
      ) : null}
      <Button type="submit" variant="secondary" size="sm">Filter</Button>
      {current.status || current.priority ? (
        <a href={action} className="text-[0.8125rem] text-(--color-ink)/50 hover:text-(--color-ink)/70">Clear</a>
      ) : null}
    </form>
  )
}

export const STATUS_OPTIONS: Option[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'pending_review', label: 'Pending review' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'changes_requested', label: 'Changes requested' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'approved', label: 'Approved' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const PRIORITY_OPTIONS: Option[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]
