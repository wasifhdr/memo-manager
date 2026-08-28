import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/tenant'
import { getMemoDetail } from '@/lib/repo/memo'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { WorkflowRail } from '@/components/memo/workflow-rail'
import { Timeline } from '@/components/memo/timeline'
import { ActionPanel } from '@/components/memo/action-panel'
import { AttachmentList } from '@/components/memo/attachment-list'
import { CommentThread } from '@/components/memo/comment-thread'
import { LinkButton } from '@/components/ui/button'
import { SubmitControl, ResubmitControl, CancelControl } from './memo-controls'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const ctx = await requireSession()
  const detail = await getMemoDetail(ctx, id)
  return { title: detail ? detail.memo.subject : 'Memo' }
}

export default async function MemoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const ctx = await requireSession()
  const detail = await getMemoDetail(ctx, id)
  if (!detail) notFound()

  const { memo, cycles, events, thread, attachments, access } = detail
  const isAuthor = memo.authorId === ctx.user.id

  const actingForName = access.actingForUserId
    ? (cycles.flatMap((c) => c.steps).find((s) => s.assigneeId === access.actingForUserId)?.assigneeName ?? null)
    : null

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <PageHeader
        eyebrow={
          <>
            <span>{memo.memoNumber}</span>
            <span>·</span>
            <span>{memo.authorName}</span>
            {memo.departmentName ? (<><span>·</span><span>{memo.departmentName}</span></>) : null}
          </>
        }
        title={memo.subject}
        actions={
          <>
            <PriorityBadge priority={memo.priority} />
            <StatusBadge status={memo.status} />
            {detail.versions.length > 1 ? (
              <LinkButton href={`/memos/${memo.id}/versions`} variant="ghost" size="sm">
                {detail.versions.length} versions
              </LinkButton>
            ) : null}
            <LinkButton href={`/api/memos/${memo.id}/pdf`} variant="secondary" size="sm">
              Export PDF
            </LinkButton>
          </>
        }
      />

      {memo.status === 'draft' && isAuthor ? (
        <Card>
          <CardBody className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[0.8125rem] text-(--color-ink)/70">
              This memo is still a draft. <a href={`/memos/${memo.id}/edit`} className="text-(--color-orange-deep) hover:underline">Edit it</a> or submit it into the workflow.
            </p>
            <SubmitControl memoId={memo.id} />
          </CardBody>
        </Card>
      ) : null}

      {memo.status === 'changes_requested' && isAuthor ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Changes were requested</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <p className="text-[0.8125rem] text-(--color-ink)/70">
              <a href={`/memos/${memo.id}/edit`} className="text-(--color-orange-deep) hover:underline">Revise the memo</a>, then resubmit it. It goes back to the participant who requested the changes.
            </p>
            <ResubmitControl memoId={memo.id} />
          </CardBody>
        </Card>
      ) : null}

      {cycles.length > 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Workflow</h2>
          </CardHeader>
          <CardBody>
            <WorkflowRail cycles={cycles} currentCycle={memo.currentCycle} currentStepNo={memo.currentStepNo} />
          </CardBody>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardBody>
              <div className="prose-memo" dangerouslySetInnerHTML={{ __html: memo.bodyHtml }} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Attachments</h2>
            </CardHeader>
            <CardBody>
              <AttachmentList memoId={memo.id} attachments={attachments} canManage={access.canEdit} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Thread</h2>
            </CardHeader>
            <CardBody>
              <CommentThread
                memoId={memo.id}
                currentUserId={ctx.user.id}
                messages={thread}
                canComment={access.canComment}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-sm font-semibold">Activity</h2>
            </CardHeader>
            <CardBody className="max-h-[26rem] overflow-y-auto">
              <Timeline events={events} />
            </CardBody>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <ActionPanel
            memoId={memo.id}
            canAct={access.canAct}
            actingForName={actingForName}
          />
          {access.canCancel ? (
            <div className="flex justify-start">
              <CancelControl memoId={memo.id} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
