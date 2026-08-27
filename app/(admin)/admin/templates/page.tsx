import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { listAllTemplatesWithSteps } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { EmptyState } from '@/components/ui/empty-state'
import { NewTemplate } from './new-template'
import { TemplateCard } from './template-card'

export const metadata: Metadata = { title: 'Workflow Templates' }

export default async function TemplatesPage() {
  const ctx = await requireAdmin()
  const templates = await listAllTemplatesWithSteps(ctx)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Workflow Templates"
        description="Reusable ordered position sequences authors can start a memo's workflow from."
      />

      <NewTemplate />

      {templates.length === 0 ? (
        <EmptyState title="No templates yet" description="Create one above to give authors a starting point." />
      ) : (
        templates.map((t) => <TemplateCard key={t.id} template={t} />)
      )}
    </div>
  )
}
