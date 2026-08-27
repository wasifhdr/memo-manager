import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { listDepartments } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { NewDepartmentForm } from './new-department-form'
import { DepartmentRow } from './department-row'

export const metadata: Metadata = { title: 'Departments' }

export default async function DepartmentsPage() {
  const ctx = await requireAdmin()
  const depts = await listDepartments(ctx)

  return (
    <div>
      <PageHeader title="Departments" description="Organize users by department. Departments are deactivated, never deleted, so memo history stays intact." />

      <NewDepartmentForm />

      {depts.length === 0 ? (
        <EmptyState title="No departments yet" description="Add your first department above." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-(--border) bg-(--surface)">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--border) bg-(--surface-sunken)">
                <th className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-(--text-faint)">Name</th>
                <th className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-(--text-faint)">Description</th>
                <th className="px-4 py-2.5 text-left text-[0.75rem] font-semibold uppercase tracking-wide text-(--text-faint)">Status</th>
                <th className="px-4 py-2.5 text-right text-[0.75rem] font-semibold uppercase tracking-wide text-(--text-faint)">Actions</th>
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
