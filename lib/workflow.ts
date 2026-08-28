import { and, asc, eq } from 'drizzle-orm'
import { db, type Tx } from '@/lib/db'
import {
  memos, workflowSteps, memoEvents, memoVersions,
  type MemoStatus, type EventType,
} from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'
import { notify, notifyMany } from '@/lib/notify'
import { audit } from '@/lib/audit'
import { activeDelegatorIds } from '@/lib/authz'

export type WorkflowAction =
  | 'approve' | 'reject' | 'request_changes' | 'comment' | 'complete_review'

export type ActResult =
  | { ok: true; status: MemoStatus }
  | { ok: false; error: string }

const TERMINAL: MemoStatus[] = ['approved', 'rejected', 'cancelled']

/** Locks the memo row for the rest of the transaction. */
async function lockMemo(tx: Tx, ctx: TenantContext, memoId: string) {
  const [memo] = await tx.select().from(memos)
    .where(and(eq(memos.id, memoId), eq(memos.orgId, ctx.orgId)))
    .for('update')
  return memo ?? null
}

async function event(tx: Tx, o: {
  orgId: string; memoId: string; type: EventType; actorId: string
  onBehalfOfId?: string | null; cycle?: number | null; stepNo?: number | null
  comment?: string | null; detail?: string | null
}) {
  await tx.insert(memoEvents).values({
    orgId: o.orgId, memoId: o.memoId, type: o.type, actorId: o.actorId,
    onBehalfOfId: o.onBehalfOfId ?? null, cycle: o.cycle ?? null,
    stepNo: o.stepNo ?? null, comment: o.comment ?? null, detail: o.detail ?? null,
  })
}

async function touch(tx: Tx, memoId: string, patch: Partial<typeof memos.$inferInsert>) {
  await tx.update(memos)
    .set({ ...patch, lastActivityAt: new Date() })
    .where(eq(memos.id, memoId))
}

function statusForStep(requiredAction: 'approve' | 'review'): MemoStatus {
  return requiredAction === 'review' ? 'pending_review' : 'pending_approval'
}

export async function submitMemo(ctx: TenantContext, memoId: string): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const memo = await lockMemo(tx, ctx, memoId)
    if (!memo) return { ok: false, error: 'Memo not found.' }
    if (memo.authorId !== ctx.user.id) return { ok: false, error: 'Only the author may submit this memo.' }
    if (memo.status !== 'draft') return { ok: false, error: 'Only a draft can be submitted.' }

    const steps = await tx.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, 1)))
      .orderBy(asc(workflowSteps.stepNo))
    if (steps.length === 0) {
      return { ok: false, error: 'Add at least one workflow participant before submitting.' }
    }

    await tx.insert(memoVersions).values({
      orgId: ctx.orgId, memoId, versionNo: 1, subject: memo.subject,
      bodyHtml: memo.bodyHtml, editorId: ctx.user.id, submittedAt: new Date(),
    })

    const first = steps[0]
    const status = statusForStep(first.requiredAction)
    await touch(tx, memoId, {
      status, currentCycle: 1, currentStepNo: first.stepNo,
      currentVersion: 1, submittedAt: new Date(),
    })

    await event(tx, { orgId: ctx.orgId, memoId, type: 'submitted', actorId: ctx.user.id, cycle: 1, stepNo: 1 })
    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'forwarded', actorId: ctx.user.id, cycle: 1, stepNo: first.stepNo,
      detail: `Forwarded to step ${first.stepNo}`,
    })

    await notifyMany(tx, steps.map((s) => s.assigneeUserId), {
      orgId: ctx.orgId, type: 'workflow_assigned', memoId,
      title: `You are a participant on ${memo.memoNumber}`, body: memo.subject,
    })
    await notify(tx, {
      orgId: ctx.orgId, userId: first.assigneeUserId, type: 'action_required', memoId,
      title: `${memo.memoNumber} needs your approval`,
      body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_submitted',
      entityType: 'memo', entityId: memoId, description: `${memo.memoNumber} submitted`,
    })
    return { ok: true, status }
  })
}

export async function actOnMemo(
  ctx: TenantContext, memoId: string, action: WorkflowAction, comment: string | null,
): Promise<ActResult> {
  const text = comment?.trim() || null
  if ((action === 'reject' || action === 'request_changes') && !text) {
    return { ok: false, error: action === 'reject'
      ? 'A rejection requires a reason.'
      : 'A change request requires a comment explaining what to change.' }
  }

  return db.transaction(async (tx) => {
    const memo = await lockMemo(tx, ctx, memoId)
    if (!memo) return { ok: false, error: 'Memo not found.' }
    if (TERMINAL.includes(memo.status)) return { ok: false, error: 'This memo is closed.' }
    if (memo.currentStepNo == null) return { ok: false, error: 'This memo is not in a workflow.' }

    const delegators = await activeDelegatorIds(ctx, ctx.user.id, tx)
    const actsFor = new Set([ctx.user.id, ...delegators])

    const allSteps = await tx.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, memo.currentCycle)))
      .orderBy(asc(workflowSteps.stepNo))

    // A comment does not advance the workflow, so any participant or the author may leave one.
    if (action === 'comment') {
      const isParticipant = allSteps.some((s) => actsFor.has(s.assigneeUserId))
      if (!isParticipant && memo.authorId !== ctx.user.id) {
        return { ok: false, error: 'Only the author and workflow participants may comment.' }
      }
      await event(tx, {
        orgId: ctx.orgId, memoId, type: 'comment', actorId: ctx.user.id,
        cycle: memo.currentCycle, stepNo: memo.currentStepNo, comment: text,
      })
      await touch(tx, memoId, {})
      const recipients = [memo.authorId, ...allSteps.map((s) => s.assigneeUserId)]
        .filter((id) => id !== ctx.user.id)
      await notifyMany(tx, recipients, {
        orgId: ctx.orgId, type: 'comment_added', memoId,
        title: `New comment on ${memo.memoNumber}`, body: text,
      })
      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'comment',
        entityType: 'memo', entityId: memoId, description: `Comment on ${memo.memoNumber}`,
      })
      return { ok: true, status: memo.status }
    }

    const current = allSteps.find((s) => s.stepNo === memo.currentStepNo)
    if (!current) return { ok: false, error: 'Workflow step not found.' }
    if (current.outcome !== 'pending') {
      // The current step already recorded a decision (most commonly
      // request_changes, which leaves currentStepNo in place until the
      // author resubmits) — no further decision can be layered on top of it.
      return { ok: false, error: 'This step has already been decided. The author must resubmit before the workflow continues.' }
    }
    if (!actsFor.has(current.assigneeUserId)) {
      return { ok: false, error: 'It is not your turn to act on this memo.' }
    }
    // Reviewer and approver are one role: any participant may sign off with
    // either verb. 'complete_review' is still accepted so rows created before
    // the merge, and the action the spec names, both keep working.

    const onBehalfOfId = current.assigneeUserId === ctx.user.id ? null : current.assigneeUserId
    const now = new Date()
    const outcome =
      action === 'approve' ? 'approved' :
      action === 'complete_review' ? 'reviewed' :
      action === 'reject' ? 'rejected' : 'changes_requested'

    await tx.update(workflowSteps)
      .set({ outcome, actedByUserId: ctx.user.id, onBehalfOfUserId: onBehalfOfId, actedAt: now, comment: text })
      .where(eq(workflowSteps.id, current.id))

    const eventType: EventType =
      action === 'approve' ? 'approved' :
      action === 'complete_review' ? 'reviewed' :
      action === 'reject' ? 'rejected' : 'changes_requested'

    await event(tx, {
      orgId: ctx.orgId, memoId, type: eventType, actorId: ctx.user.id,
      onBehalfOfId, cycle: memo.currentCycle, stepNo: current.stepNo, comment: text,
    })

    const participants = allSteps.map((s) => s.assigneeUserId)

    if (action === 'reject') {
      await tx.update(workflowSteps).set({ outcome: 'skipped' }).where(and(
        eq(workflowSteps.memoId, memoId),
        eq(workflowSteps.cycle, memo.currentCycle),
        eq(workflowSteps.outcome, 'pending'),
      ))
      await touch(tx, memoId, { status: 'rejected', currentStepNo: null, completedAt: now })
      await notifyMany(tx, [memo.authorId, ...participants].filter((id) => id !== ctx.user.id), {
        orgId: ctx.orgId, type: 'rejected', memoId,
        title: `${memo.memoNumber} was rejected`, body: text,
      })
      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_rejected',
        entityType: 'memo', entityId: memoId, description: `${memo.memoNumber} rejected`,
      })
      return { ok: true, status: 'rejected' }
    }

    if (action === 'request_changes') {
      await touch(tx, memoId, { status: 'changes_requested' })
      await notify(tx, {
        orgId: ctx.orgId, userId: memo.authorId, type: 'changes_requested', memoId,
        title: `Changes requested on ${memo.memoNumber}`, body: text,
      })
      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'change_request',
        entityType: 'memo', entityId: memoId, description: `Changes requested on ${memo.memoNumber}`,
      })
      return { ok: true, status: 'changes_requested' }
    }

    // approve / complete_review — advance or complete
    const next = allSteps.find((s) => s.stepNo > current.stepNo && s.outcome === 'pending')

    if (!next) {
      await touch(tx, memoId, {
        status: 'approved', currentStepNo: null,
        completedAt: now, finalApproverId: ctx.user.id,
      })
      await event(tx, {
        orgId: ctx.orgId, memoId, type: 'completed', actorId: ctx.user.id,
        cycle: memo.currentCycle, stepNo: current.stepNo,
        detail: 'Workflow completed — memo approved',
      })
      await notifyMany(tx, [memo.authorId, ...participants], {
        orgId: ctx.orgId, type: 'workflow_completed', memoId,
        title: `${memo.memoNumber} is fully approved`, body: memo.subject,
      })
      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'workflow_completed',
        entityType: 'memo', entityId: memoId, description: `${memo.memoNumber} approved`,
      })
      return { ok: true, status: 'approved' }
    }

    const status = statusForStep(next.requiredAction)
    await touch(tx, memoId, { status, currentStepNo: next.stepNo })
    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'forwarded', actorId: ctx.user.id,
      cycle: memo.currentCycle, stepNo: next.stepNo, detail: `Forwarded to step ${next.stepNo}`,
    })
    await notify(tx, {
      orgId: ctx.orgId, userId: next.assigneeUserId, type: 'action_required', memoId,
      title: `${memo.memoNumber} needs your approval`,
      body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_approved',
      entityType: 'memo', entityId: memoId,
      description: `${memo.memoNumber} ${outcome} at step ${current.stepNo}`,
    })
    return { ok: true, status }
  })
}

export async function resubmitMemo(
  ctx: TenantContext, memoId: string,
): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const memo = await lockMemo(tx, ctx, memoId)
    if (!memo) return { ok: false, error: 'Memo not found.' }
    if (memo.authorId !== ctx.user.id) return { ok: false, error: 'Only the author may resubmit this memo.' }
    if (memo.status !== 'changes_requested') {
      return { ok: false, error: 'Only a memo with changes requested can be resubmitted.' }
    }

    const prev = await tx.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, memo.currentCycle)))
      .orderBy(asc(workflowSteps.stepNo))

    const requester = prev.find((s) => s.outcome === 'changes_requested')
    const cycle = memo.currentCycle + 1
    const versionNo = memo.currentVersion + 1
    const now = new Date()

    await tx.insert(memoVersions).values({
      orgId: ctx.orgId, memoId, versionNo, subject: memo.subject,
      bodyHtml: memo.bodyHtml, editorId: ctx.user.id, submittedAt: now,
    })

    // A resubmission always resumes at the participant who asked for the changes;
    // everyone before them keeps the decision they already made.
    const resumeAt = requester ? requester.stepNo : prev[0].stepNo
    await tx.insert(workflowSteps).values(prev.map((s) => ({
      orgId: ctx.orgId, memoId, cycle, stepNo: s.stepNo,
      positionTitle: s.positionTitle, assigneeUserId: s.assigneeUserId,
      requiredAction: s.requiredAction,
      outcome: (s.stepNo < resumeAt ? s.outcome : 'pending') as typeof s.outcome,
      actedByUserId: s.stepNo < resumeAt ? s.actedByUserId : null,
      onBehalfOfUserId: s.stepNo < resumeAt ? s.onBehalfOfUserId : null,
      actedAt: s.stepNo < resumeAt ? s.actedAt : null,
      comment: s.stepNo < resumeAt ? s.comment : null,
    })))

    const target = prev.find((s) => s.stepNo === resumeAt)!
    const status = statusForStep(target.requiredAction)
    await touch(tx, memoId, {
      status, currentCycle: cycle, currentStepNo: resumeAt, currentVersion: versionNo,
    })

    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'version_created', actorId: ctx.user.id,
      cycle, detail: `Version ${versionNo} created`,
    })
    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'resubmitted', actorId: ctx.user.id, cycle, stepNo: resumeAt,
      detail: `Resubmitted — resumed at step ${resumeAt}`,
    })
    await notify(tx, {
      orgId: ctx.orgId, userId: target.assigneeUserId, type: 'resubmitted', memoId,
      title: `${memo.memoNumber} was revised and needs your attention`, body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_resubmitted',
      entityType: 'memo', entityId: memoId,
      description: `${memo.memoNumber} resubmitted as version ${versionNo}`,
    })
    return { ok: true, status }
  })
}

export async function cancelMemo(
  ctx: TenantContext, memoId: string, reason: string | null,
): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const memo = await lockMemo(tx, ctx, memoId)
    if (!memo) return { ok: false, error: 'Memo not found.' }
    const allowed = memo.authorId === ctx.user.id || ctx.user.role === 'org_admin'
    if (!allowed) return { ok: false, error: 'You cannot cancel this memo.' }
    if (TERMINAL.includes(memo.status)) return { ok: false, error: 'This memo is already closed.' }
    if (memo.status === 'draft') return { ok: false, error: 'Delete the draft instead of cancelling it.' }

    const steps = await tx.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, memo.currentCycle)))
    await tx.update(workflowSteps).set({ outcome: 'skipped' }).where(and(
      eq(workflowSteps.memoId, memoId),
      eq(workflowSteps.cycle, memo.currentCycle),
      eq(workflowSteps.outcome, 'pending'),
    ))
    await touch(tx, memoId, {
      status: 'cancelled', currentStepNo: null, cancelledAt: new Date(),
    })
    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'cancelled', actorId: ctx.user.id,
      cycle: memo.currentCycle, comment: reason,
    })
    await notifyMany(tx, steps.map((s) => s.assigneeUserId).filter((id) => id !== ctx.user.id), {
      orgId: ctx.orgId, type: 'rejected', memoId,
      title: `${memo.memoNumber} was cancelled`, body: reason,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_cancelled',
      entityType: 'memo', entityId: memoId, description: `${memo.memoNumber} cancelled`,
    })
    return { ok: true, status: 'cancelled' }
  })
}
