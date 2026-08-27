import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { listDepartments } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { NewDepartmentButton } from './new-department-form'
import { DepartmentRow } from './department-row'

export const metadata: Metadata = { title: 'Departments' }

export default async function DepartmentsPage() {
  const ctx = await requireAdmin()
  const depts = await listDepartments(ctx)

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Organize users by department. Departments are deactivated, never deleted, so memo history stays intact."
        actions={<NewDepartmentButton />}
      />

      {depts.length === 0 ? (
        <EmptyState title="No departments yet" description="Add your first department to get started." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper)">
          <table className="w-full min-w-[20rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--color-sand) bg-(--color-cream)">
                <th className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-(--color-ink)/50">Name</th>
                <th className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-(--color-ink)/50 hidden md:table-cell">Description</th>
                <th className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-(--color-ink)/50">Status</th>
                <th className="px-4 py-2.5 text-right text-[0.75rem] font-semibold uppercase tracking-wide text-(--color-ink)/50">Actions</th>
              </tr>
            </thead>
            <tbody>
              {depts.map((d) => <DepartmentRow key={d.id} dept={d} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
