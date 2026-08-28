import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { listUsers, listDepartments } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { NewUserButton } from './new-user-button'
import { BulkAddUsersButton } from './bulk-add-users'
import { UserRow } from './user-row'

export const metadata: Metadata = { title: 'Users' }

// [label, extra classes] — secondary columns only appear once there is room
const HEADERS: [string, string][] = [
  ['Name', ''],
  ['Designation', 'hidden lg:table-cell'],
  ['Department', 'hidden lg:table-cell'],
  ['Role', 'hidden sm:table-cell'],
  ['Status', 'hidden sm:table-cell'],
  ['Last login', 'hidden xl:table-cell'],
  ['Actions', ''],
]

export default async function UsersPage() {
  const ctx = await requireAdmin()
  const [userRows, depts] = await Promise.all([listUsers(ctx), listDepartments(ctx, { activeOnly: true })])
  const departmentOptions = depts.map((d) => ({ value: d.id, label: d.name }))

  return (
    <div>
      <PageHeader
        title="Users"
        description="Invite users, assign departments and roles, and activate or deactivate accounts."
        actions={
          <>
            <BulkAddUsersButton />
            <NewUserButton departments={departmentOptions} />
          </>
        }
      />

      {userRows.length === 0 ? (
        <EmptyState title="No users yet" description="Add your first user to get started." />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-(--color-sand) bg-(--color-paper)">
          <table className="w-full min-w-[20rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-(--color-sand) bg-(--color-cream)">
                {HEADERS.map(([label, responsive], i) => (
                  <th
                    key={label}
                    className={`px-4 py-2.5 text-[0.75rem] font-semibold uppercase tracking-wide text-(--color-ink)/50 ${responsive} ${i === HEADERS.length - 1 ? 'text-right' : 'text-left'}`}
                  >
                    {label}
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
