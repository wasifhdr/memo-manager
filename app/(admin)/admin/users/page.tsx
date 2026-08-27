import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { listUsers, listDepartments } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { NewUserForm } from './new-user-form'
import { UserRow } from './user-row'

export const metadata: Metadata = { title: 'Users' }

const HEADERS = ['Name', 'Designation', 'Department', 'Role', 'Status', 'Last login', 'Actions']

export default async function UsersPage() {
  const ctx = await requireAdmin()
  const [userRows, depts] = await Promise.all([listUsers(ctx), listDepartments(ctx, { activeOnly: true })])
  const departmentOptions = depts.map((d) => ({ value: d.id, label: d.name }))

  return (
    <div>
      <PageHeader title="Users" description="Invite users, assign departments and roles, and activate or deactivate accounts." />

      <NewUserForm departments={departmentOptions} />

      {userRows.length === 0 ? (
        <EmptyState title="No users yet" description="Add your first user above." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper)">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--color-sand) bg-(--color-cream)">
                {HEADERS.map((h, i) => (
                  <th
                    key={h}
                    className={`px-4 py-2.5 text-[0.75rem] font-semibold uppercase tracking-wide text-(--color-ink)/50 ${i === HEADERS.length - 1 ? 'text-right' : 'text-left'}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {userRows.map((u) => (
                <UserRow key={u.id} user={u} departments={departmentOptions} isSelf={u.id === ctx.user.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
