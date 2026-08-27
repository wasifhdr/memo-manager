import type { Metadata } from 'next'
import { requireSession } from '@/lib/tenant'
import { listDepartments, listCategories } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { NewMemoForm } from './new-memo-form'

export const metadata: Metadata = { title: 'New Memo' }

export default async function NewMemoPage() {
  const ctx = await requireSession()
  const [departments, categories] = await Promise.all([
    listDepartments(ctx, { activeOnly: true }),
    listCategories(ctx, { activeOnly: true }),
  ])

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="New memo" description="Save a draft, then add workflow participants and attachments." />
      <NewMemoForm
        departments={departments.map((d) => ({ value: d.id, label: d.name }))}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
      />
    </div>
  )
}
