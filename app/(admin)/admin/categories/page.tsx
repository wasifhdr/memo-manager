import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { listCategories } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { NewCategoryForm } from './new-category-form'
import { CategoryRow } from './category-row'

export const metadata: Metadata = { title: 'Memo Categories' }

export default async function CategoriesPage() {
  const ctx = await requireAdmin()
  const cats = await listCategories(ctx)

  return (
    <div>
      <PageHeader title="Memo Categories" description="Categories help organize and filter memos across the organization." />

      <NewCategoryForm />

      {cats.length === 0 ? (
        <EmptyState title="No categories yet" description="Add your first category above." />
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
              {cats.map((c) => <CategoryRow key={c.id} cat={c} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
