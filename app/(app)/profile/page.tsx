import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'
import { requireSession } from '@/lib/tenant'
import { db } from '@/lib/db'
import { departments } from '@/db/schema'
import { PageHeader } from '@/components/ui/page-header'
import { EditProfileForm, ChangePasswordForm } from './profile-forms'

export const metadata: Metadata = { title: 'Profile' }

export default async function ProfilePage() {
  const ctx = await requireSession()

  const department = ctx.user.departmentId
    ? (await db.select({ name: departments.name }).from(departments)
        .where(eq(departments.id, ctx.user.departmentId)).limit(1))[0]
    : undefined

  const fields: { label: string; value: string }[] = [
    { label: 'Email', value: ctx.user.email },
    { label: 'Designation', value: ctx.user.designation || '—' },
    { label: 'Department', value: department?.name ?? '—' },
    { label: 'Role', value: ctx.user.role === 'org_admin' ? 'Organization administrator' : 'Member' },
    { label: 'Account status', value: ctx.user.status === 'active' ? 'Active' : 'Inactive' },
  ]

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Your profile" description="View and update your account." />

      <div className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
        {fields.map((f) => (
          <div key={f.label}>
            <dt className="text-[0.6875rem] font-semibold uppercase tracking-wide text-(--text-faint)">{f.label}</dt>
            <dd className="mt-0.5 text-sm text-(--text)">{f.value}</dd>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <EditProfileForm name={ctx.user.name} designation={ctx.user.designation} />
        <ChangePasswordForm />
      </div>
    </div>
  )
}
