import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { listCategories } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { NewCategoryButton } from './new-category-form'
import { CategoryRow } from './category-row'

export const metadata: Metadata = { title: 'Memo Categories' }

export default async function CategoriesPage() {
  const ctx = await requireAdmin()
  const cats = await listCategories(ctx)

  return (
    <div>
      <PageHeader
        title="Memo Categories"
        description="Categories help organize and filter memos across the organization."
        actions={<NewCategoryButton />}
      />

      {cats.length === 0 ? (
        <EmptyState title="No categories yet" description="Add your first category to get started." />
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
              {cats.map((c) => <CategoryRow key={c.id} cat={c} />)}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
