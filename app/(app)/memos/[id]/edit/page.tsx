import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/tenant'
import { listDepartments, listCategories, listActiveUsers, listTemplatesWithSteps } from '@/lib/repo/org'
import { getOwnedMemo, listAttachmentsWithUploader, getDraftParticipants } from '@/lib/repo/memo'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/badge'
import { EditMemoForm } from './edit-memo-form'
import { ParticipantPicker } from '@/components/memo/participant-picker'
import { AttachmentList } from '@/components/memo/attachment-list'

export const metadata: Metadata = { title: 'Edit Memo' }

export default async function EditMemoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireSession()

  const memo = await getOwnedMemo(ctx, id)
  if (!memo) notFound()
  if (memo.status !== 'draft' && memo.status !== 'changes_requested') {
    notFound()
  }

  const [departments, categories, activeUsers, templates, attachments, participants] = await Promise.all([
    listDepartments(ctx, { activeOnly: true }),
    listCategories(ctx, { activeOnly: true }),
    listActiveUsers(ctx),
    listTemplatesWithSteps(ctx),
    listAttachmentsWithUploader(ctx, id),
    getDraftParticipants(ctx, id),
  ])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeader
        title={memo.subject}
        eyebrow={<span>{memo.memoNumber}</span>}
        description="Editable while this memo is a draft or changes have been requested."
        actions={<StatusBadge status={memo.status} />}
      />

      <EditMemoForm
        memo={{
          id: memo.id, subject: memo.subject, bodyHtml: memo.bodyHtml,
          departmentId: memo.departmentId, categoryId: memo.categoryId, priority: memo.priority,
        }}
        departments={departments.map((d) => ({ value: d.id, label: d.name }))}
        categories={categories.map((c) => ({ value: c.id, label: c.name }))}
        canDelete={memo.status === 'draft'}
      />

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Workflow participants</h2>
        </CardHeader>
        <CardBody>
          <ParticipantPicker
            memoId={memo.id}
            activeUsers={activeUsers}
            templates={templates}
            initialSteps={participants.map((p) => ({
              assigneeUserId: p.assigneeUserId,
              positionTitle: p.positionTitle ?? '',
              requiredAction: p.requiredAction,
            }))}
          />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Attachments</h2>
        </CardHeader>
        <CardBody>
          <AttachmentList memoId={memo.id} attachments={attachments} canManage />
        </CardBody>
      </Card>
    </div>
  )
}
