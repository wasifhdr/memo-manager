import { and, eq, gt, lte } from 'drizzle-orm'
import { db, type Executor } from '@/lib/db'
import { memos, workflowSteps, delegations } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export type MemoAccess = {
  memoId: string
  canView: boolean
  canAct: boolean
  canEdit: boolean
  canCancel: boolean
  /** Mirrors workflow.ts's own comment rule: author, or a participant of the
   * CURRENT cycle — not just the assignee whose turn it currently is. */
  canComment: boolean
  /** May re-route the workflow: the author, or whoever is holding the memo. */
  canRoute: boolean
  /** Set when the viewer may act only because someone delegated to them. */
  actingForUserId: string | null
}

/** Ids of users who have delegated their authority to `delegateId` right now. */
export async function activeDelegatorIds(
  ctx: TenantContext, delegateId: string, ex: Executor = db,
): Promise<string[]> {
  const now = new Date()
  const rows = await ex.select({ id: delegations.delegatorId }).from(delegations)
    .where(and(
      eq(delegations.orgId, ctx.orgId),
      eq(delegations.delegateId, delegateId),
      eq(delegations.status, 'active'),
      lte(delegations.startAt, now),
      gt(delegations.endAt, now),
    ))
  return rows.map((r) => r.id)
}

const TERMINAL = ['approved', 'rejected', 'cancelled'] as const

export async function getMemoAccess(
  ctx: TenantContext, memoId: string, ex: Executor = db,
): Promise<MemoAccess | null> {
  const [memo] = await ex.select().from(memos)
    .where(and(eq(memos.id, memoId), eq(memos.orgId, ctx.orgId)))
    .limit(1)
  if (!memo) return null                       // wrong org reads as "does not exist"

  const isAuthor = memo.authorId === ctx.user.id
  const isAdmin = ctx.user.role === 'org_admin'

  const participation = await ex.select({
    stepNo: workflowSteps.stepNo,
    cycle: workflowSteps.cycle,
    assignee: workflowSteps.assigneeUserId,
    outcome: workflowSteps.outcome,
  }).from(workflowSteps).where(eq(workflowSteps.memoId, memoId))

  const delegators = await activeDelegatorIds(ctx, ctx.user.id, ex)
  const actsFor = new Set([ctx.user.id, ...delegators])

  const isParticipant = participation.some((s) => actsFor.has(s.assignee))
  const canView = isAuthor || isAdmin || isParticipant

  const terminal = (TERMINAL as readonly string[]).includes(memo.status)
  let canAct = false
  let actingForUserId: string | null = null

  if (!terminal && memo.currentStepNo != null && memo.currentCycle > 0) {
    const current = participation.find(
      (s) => s.cycle === memo.currentCycle && s.stepNo === memo.currentStepNo,
    )
    // A step that already recorded a decision (typically request_changes,
    // which leaves currentStepNo in place until the author resubmits) is not
    // actionable again — mirrors the same guard in lib/workflow.ts.
    if (current && current.outcome === 'pending' && actsFor.has(current.assignee)) {
      canAct = true
      actingForUserId = current.assignee === ctx.user.id ? null : current.assignee
    }
  }

  // Mirrors ROUTABLE in lib/workflow.ts: re-routing needs a memo that is
  // actually sitting on someone's desk.
  const inFlight = memo.status === 'pending_approval' || memo.status === 'pending_review'
  const canRoute = inFlight && memo.currentStepNo != null && (isAuthor || canAct)

  const canEdit = isAuthor && (memo.status === 'draft' || memo.status === 'changes_requested')
  const canCancel = (isAuthor || isAdmin) && !terminal && memo.status !== 'draft'
  const isCurrentCycleParticipant = participation.some(
    (s) => s.cycle === memo.currentCycle && actsFor.has(s.assignee),
  )
  const canComment = !terminal && memo.currentCycle > 0 && (isAuthor || isCurrentCycleParticipant)

  return { memoId, canView, canAct, canEdit, canCancel, canComment, canRoute, actingForUserId }
}
