import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/tenant'
import { getMemoDetail } from '@/lib/repo/memo'
import {
  listActiveUsers, listDepartments, listCategories, listTemplatesWithSteps, listDesignations,
} from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { StatusBadge, PriorityBadge } from '@/components/ui/badge'
import { Card, CardHeader, CardBody } from '@/components/ui/card'
import { WorkflowRail } from '@/components/memo/workflow-rail'
import { Timeline } from '@/components/memo/timeline'
import { ActionPanel } from '@/components/memo/action-panel'
import { AttachmentList } from '@/components/memo/attachment-list'
import { CommentThread } from '@/components/memo/comment-thread'
import { RoutingPanel } from '@/components/memo/routing-panel'
import { EditMemoButton } from '@/components/memo/edit-memo-button'
import { LinkButton } from '@/components/ui/button'
import { formatDate, formatTimeOfDay } from '@/lib/format'
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
  // Only the re-routing controls need the org roster, so it is fetched only
  // when the viewer can actually re-route.
  const [activeUsers, designations] = access.canRoute || access.canEdit
    ? await Promise.all([listActiveUsers(ctx), listDesignations(ctx)])
    : [[], []]

  // Everything the edit modal needs, fetched only for the author who can open it.
  const editable = access.canEdit
    ? await (async () => {
      const [departments, categories, templates] = await Promise.all([
        listDepartments(ctx, { activeOnly: true }),
        listCategories(ctx, { activeOnly: true }),
        listTemplatesWithSteps(ctx),
      ])
      const queue = cycles.find((c) => c.cycle === Math.max(memo.currentCycle, 1))?.steps ?? []
      return {
        departments: departments.map((d) => ({ value: d.id, label: d.name })),
        categories: categories.map((c) => ({ value: c.id, label: c.name })),
        templates,
        designations,
        activeUsers,
        participants: queue.map((s) => ({
          assigneeUserId: s.assigneeId, positionTitle: s.positionTitle ?? '',
          requiredAction: s.requiredAction, assigneeName: s.assigneeName,
        })),
      }
    })()
    : null
  const isAuthor = memo.authorId === ctx.user.id

  // Whoever asked for changes in the current cycle — the author's card quotes them.
  const changeRequest = memo.status === 'changes_requested'
    ? cycles.find((c) => c.cycle === memo.currentCycle)?.steps.find((s) => s.outcome === 'changes_requested') ?? null
    : null

  const currentSteps = cycles.find((c) => c.cycle === memo.currentCycle)?.steps ?? []
  const currentStep = currentSteps.find((s) => s.stepNo === memo.currentStepNo) ?? null
  const queuedAfter = currentSteps.filter(
    (s) => s.stepNo > (memo.currentStepNo ?? 0) && s.outcome === 'pending',
  )

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
              This memo is still a draft. Edit it, or submit it into the workflow as it stands.
            </p>
            <div className="flex flex-wrap items-start gap-3">
              {editable ? (
                <EditMemoButton
                  label="Edit memo"
                  variant="secondary"
                  memo={{
                    id: memo.id, subject: memo.subject, bodyHtml: memo.bodyHtml,
                    departmentId: memo.departmentId, categoryId: memo.categoryId,
                    priority: memo.priority, status: 'draft',
                  }}
                  attachments={attachments}
                  {...editable}
                />
              ) : null}
              <SubmitControl memoId={memo.id} />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {memo.status === 'changes_requested' && isAuthor ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Changes were requested</h2>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <p className="text-[0.8125rem] text-(--color-ink)">
              {changeRequest?.actedAt ? (
                <>
                  At {formatTimeOfDay(changeRequest.actedAt)}, {formatDate(changeRequest.actedAt)},{' '}
                  <span className="font-bold">{changeRequest.actedByName ?? changeRequest.assigneeName}</span>{' '}
                  {changeRequest.comment
                    ? <>commented &ldquo;{changeRequest.comment}&rdquo;.</>
                    : <>requested changes.</>}
                </>
              ) : (
                'A participant asked for changes before this memo can move on.'
              )}
            </p>
            <div className="flex flex-wrap items-start gap-3">
              {editable ? (
                <EditMemoButton
                  label="Revise memo"
                  memo={{
                    id: memo.id, subject: memo.subject, bodyHtml: memo.bodyHtml,
                    departmentId: memo.departmentId, categoryId: memo.categoryId,
                    priority: memo.priority, status: 'changes_requested',
                  }}
                  attachments={attachments}
                  {...editable}
                />
              ) : null}
              <ResubmitControl memoId={memo.id} />
            </div>
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
            currentStepId={currentStep?.id ?? null}
            activeUsers={activeUsers}
            designations={designations}
          />

          {access.canRoute && currentStep ? (
            <RoutingPanel
              memoId={memo.id}
              current={{
                id: currentStep.id, stepNo: currentStep.stepNo,
                positionTitle: currentStep.positionTitle, assigneeName: currentStep.assigneeName,
              }}
              pending={queuedAfter.map((s) => ({
                id: s.id, stepNo: s.stepNo, positionTitle: s.positionTitle, assigneeName: s.assigneeName,
              }))}
              canReassignCurrent={isAuthor}
              activeUsers={activeUsers}
              designations={designations}
            />
          ) : null}

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
