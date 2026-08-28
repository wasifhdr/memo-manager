import { and, asc, eq, gte, sql } from 'drizzle-orm'
import { db, type Tx } from '@/lib/db'
import {
  memos, workflowSteps, memoEvents, memoVersions, users,
  type MemoStatus, type EventType, type RequiredAction,
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

/** The memo is in flight and sitting on someone's desk — the only time it can be re-routed. */
const ROUTABLE: MemoStatus[] = ['pending_approval', 'pending_review']

/**
 * Opens a slot at `at` by pushing that step and everything after it one place
 * down. Two statements, because a single `step_no + 1` would collide with the
 * (memo, cycle, step_no) unique index row by row on the way up.
 *
 * Only ever called for positions after the current step, so no step that has
 * acted — and therefore no memo_event pointing at a step number — can move.
 */
async function makeRoom(tx: Tx, memoId: string, cycle: number, at: number) {
  const scope = (from: number) => and(
    eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, cycle), gte(workflowSteps.stepNo, from),
  )
  await tx.update(workflowSteps).set({ stepNo: sql`${workflowSteps.stepNo} + 1000` }).where(scope(at))
  await tx.update(workflowSteps).set({ stepNo: sql`${workflowSteps.stepNo} - 999` }).where(scope(1000))
}

/** The named user, only if they are an active member of the caller's organization. */
async function activeOrgUser(tx: Tx, ctx: TenantContext, userId: string) {
  const [u] = await tx.select({ id: users.id, name: users.name }).from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, ctx.orgId), eq(users.status, 'active')))
  return u ?? null
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
  /** Approve and hand the memo to someone outside the workflow before it moves on. */
  forwardTo?: { userId: string; positionTitle: string | null } | null,
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

    // Everything is validated before the first write: returning `ok: false`
    // from inside a transaction commits what came before it.
    let forwardee: { id: string; name: string } | null = null
    if (forwardTo) {
      if (action !== 'approve' && action !== 'complete_review') {
        return { ok: false, error: 'Only an approval can forward the memo onward.' }
      }
      forwardee = await activeOrgUser(tx, ctx, forwardTo.userId)
      if (!forwardee) return { ok: false, error: 'That person is not an active user in your organization.' }
      if (allSteps.some((s) => s.outcome === 'pending' && s.assigneeUserId === forwardTo.userId)) {
        return { ok: false, error: 'That person is already waiting on this memo.' }
      }
    }

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
    let next = allSteps.find((s) => s.stepNo > current.stepNo && s.outcome === 'pending')

    if (forwardTo && forwardee) {
      const at = current.stepNo + 1
      await makeRoom(tx, memoId, memo.currentCycle, at)
      const [inserted] = await tx.insert(workflowSteps).values({
        orgId: ctx.orgId, memoId, cycle: memo.currentCycle, stepNo: at,
        positionTitle: forwardTo.positionTitle?.trim() || null,
        assigneeUserId: forwardee.id, requiredAction: 'approve',
      }).returning()
      await event(tx, {
        orgId: ctx.orgId, memoId, type: 'participant_added', actorId: ctx.user.id,
        cycle: memo.currentCycle, stepNo: at,
        detail: `${forwardee.name} added to the workflow at step ${at}`,
      })
      next = inserted
    }

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

/**
 * Shared gate for the three re-routing operations. The memo must be in flight,
 * and the caller must be either its author — who may unstick it at any seat —
 * or the participant currently holding it.
 */
async function routingContext(tx: Tx, ctx: TenantContext, memoId: string) {
  const memo = await lockMemo(tx, ctx, memoId)
  if (!memo) return { ok: false as const, error: 'Memo not found.' }
  if (!ROUTABLE.includes(memo.status) || memo.currentStepNo == null) {
    return { ok: false as const, error: 'This memo is not waiting on anyone right now.' }
  }

  const steps = await tx.select().from(workflowSteps)
    .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, memo.currentCycle)))
    .orderBy(asc(workflowSteps.stepNo))
  const current = steps.find((s) => s.stepNo === memo.currentStepNo)
  if (!current) return { ok: false as const, error: 'Workflow step not found.' }

  const delegators = await activeDelegatorIds(ctx, ctx.user.id, tx)
  const actsFor = new Set([ctx.user.id, ...delegators])
  const isAuthor = memo.authorId === ctx.user.id
  const isHolder = actsFor.has(current.assigneeUserId)
  if (!isAuthor && !isHolder) {
    return { ok: false as const, error: 'Only the author and the participant holding this memo can re-route it.' }
  }

  return { ok: true as const, memo, steps, current, isAuthor, isHolder }
}

/**
 * Hands a seat to someone else. A participant may hand over the seat they are
 * holding — declining without deciding; the author may reassign any seat that
 * has not acted, including the one the memo is sitting on.
 */
export async function reassignStep(
  ctx: TenantContext, memoId: string, stepId: string,
  toUserId: string, positionTitle: string | null, comment: string | null,
): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const c = await routingContext(tx, ctx, memoId)
    if (!c.ok) return { ok: false, error: c.error }
    const { memo, steps, current, isAuthor } = c

    const step = steps.find((s) => s.id === stepId)
    if (!step) return { ok: false, error: 'Workflow step not found.' }
    if (step.outcome !== 'pending') return { ok: false, error: 'That step has already been decided.' }
    if (!isAuthor && step.id !== current.id) {
      return { ok: false, error: 'You can only hand over the step you are holding.' }
    }

    const target = await activeOrgUser(tx, ctx, toUserId)
    if (!target) return { ok: false, error: 'That person is not an active user in your organization.' }
    if (target.id === step.assigneeUserId) {
      return { ok: false, error: 'That person already holds this step.' }
    }
    if (steps.some((s) => s.id !== step.id && s.outcome === 'pending' && s.assigneeUserId === target.id)) {
      return { ok: false, error: 'That person is already waiting on this memo.' }
    }

    await tx.update(workflowSteps).set({
      assigneeUserId: target.id,
      positionTitle: positionTitle?.trim() || step.positionTitle,
    }).where(eq(workflowSteps.id, step.id))

    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'reassigned', actorId: ctx.user.id,
      cycle: memo.currentCycle, stepNo: step.stepNo, comment: comment?.trim() || null,
      detail: `Step ${step.stepNo} handed to ${target.name}`,
    })
    await touch(tx, memoId, {})

    const isCurrentSeat = step.id === current.id
    await notify(tx, {
      orgId: ctx.orgId, userId: target.id,
      type: isCurrentSeat ? 'action_required' : 'workflow_assigned', memoId,
      title: isCurrentSeat
        ? `${memo.memoNumber} needs your approval`
        : `You are a participant on ${memo.memoNumber}`,
      body: memo.subject,
    })
    await notifyMany(tx, [memo.authorId, step.assigneeUserId].filter((id) => id !== ctx.user.id), {
      orgId: ctx.orgId, type: 'workflow_assigned', memoId,
      title: `${memo.memoNumber} was handed to ${target.name}`, body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'participant_assigned',
      entityType: 'memo', entityId: memoId,
      description: `${memo.memoNumber} step ${step.stepNo} reassigned to ${target.name}`,
    })
    return { ok: true, status: memo.status }
  })
}

/** Adds someone to the queue, immediately after `afterStepNo`. */
export async function addParticipant(
  ctx: TenantContext, memoId: string,
  input: { afterStepNo: number; userId: string; positionTitle: string | null; requiredAction?: RequiredAction },
): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const c = await routingContext(tx, ctx, memoId)
    if (!c.ok) return { ok: false, error: c.error }
    const { memo, steps, current } = c

    const last = steps[steps.length - 1]?.stepNo ?? current.stepNo
    if (input.afterStepNo < current.stepNo || input.afterStepNo > last) {
      return { ok: false, error: 'A participant can only be added after the step holding the memo.' }
    }

    const target = await activeOrgUser(tx, ctx, input.userId)
    if (!target) return { ok: false, error: 'That person is not an active user in your organization.' }
    if (steps.some((s) => s.outcome === 'pending' && s.assigneeUserId === target.id)) {
      return { ok: false, error: 'That person is already waiting on this memo.' }
    }

    const at = input.afterStepNo + 1
    await makeRoom(tx, memoId, memo.currentCycle, at)
    await tx.insert(workflowSteps).values({
      orgId: ctx.orgId, memoId, cycle: memo.currentCycle, stepNo: at,
      positionTitle: input.positionTitle?.trim() || null,
      assigneeUserId: target.id, requiredAction: input.requiredAction ?? 'approve',
    })

    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'participant_added', actorId: ctx.user.id,
      cycle: memo.currentCycle, stepNo: at,
      detail: `${target.name} added to the workflow at step ${at}`,
    })
    await touch(tx, memoId, {})
    await notify(tx, {
      orgId: ctx.orgId, userId: target.id, type: 'workflow_assigned', memoId,
      title: `You are a participant on ${memo.memoNumber}`, body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'participant_assigned',
      entityType: 'memo', entityId: memoId,
      description: `${target.name} added to ${memo.memoNumber} at step ${at}`,
    })
    return { ok: true, status: memo.status }
  })
}

/**
 * Drops someone still waiting. The row stays, marked `skipped`, so the rail
 * still shows that they were in the queue and who took them out. The seat
 * holding the memo cannot be removed — hand it over instead — which also keeps
 * at least one participant left to decide.
 */
export async function removeParticipant(
  ctx: TenantContext, memoId: string, stepId: string,
): Promise<ActResult> {
  return db.transaction(async (tx) => {
    const c = await routingContext(tx, ctx, memoId)
    if (!c.ok) return { ok: false, error: c.error }
    const { memo, steps, current } = c

    const step = steps.find((s) => s.id === stepId)
    if (!step) return { ok: false, error: 'Workflow step not found.' }
    if (step.outcome !== 'pending') return { ok: false, error: 'That step has already been decided.' }
    if (step.id === current.id) {
      return { ok: false, error: 'This step is holding the memo — hand it over instead of removing it.' }
    }
    const remaining = steps.filter((s) => s.outcome === 'pending' && s.id !== step.id)
    if (remaining.length === 0) {
      return { ok: false, error: 'Someone has to decide — a memo cannot be left with no participants.' }
    }

    const [assignee] = await tx.select({ name: users.name }).from(users)
      .where(eq(users.id, step.assigneeUserId))

    await tx.update(workflowSteps)
      .set({ outcome: 'skipped', actedByUserId: ctx.user.id, actedAt: new Date() })
      .where(eq(workflowSteps.id, step.id))

    await event(tx, {
      orgId: ctx.orgId, memoId, type: 'participant_removed', actorId: ctx.user.id,
      cycle: memo.currentCycle, stepNo: step.stepNo,
      detail: `${assignee?.name ?? 'A participant'} removed from the workflow`,
    })
    await touch(tx, memoId, {})
    await notifyMany(tx, [memo.authorId, step.assigneeUserId].filter((id) => id !== ctx.user.id), {
      orgId: ctx.orgId, type: 'workflow_assigned', memoId,
      title: `${assignee?.name ?? 'A participant'} was removed from ${memo.memoNumber}`,
      body: memo.subject,
    })
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'participant_assigned',
      entityType: 'memo', entityId: memoId,
      description: `${assignee?.name ?? 'A participant'} removed from ${memo.memoNumber}`,
    })
    return { ok: true, status: memo.status }
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

    // Anyone removed while the memo was in flight stays removed; the rest are
    // renumbered 1..N so the new cycle has no gaps where they were.
    const kept = prev.filter((s) => s.outcome !== 'skipped')
    if (kept.length === 0) return { ok: false, error: 'This memo has no workflow participants left.' }
    const renumbered = kept.map((s, i) => ({ ...s, newStepNo: i + 1 }))
    const requester = renumbered.find((s) => s.outcome === 'changes_requested')
    const cycle = memo.currentCycle + 1
    const versionNo = memo.currentVersion + 1
    const now = new Date()

    await tx.insert(memoVersions).values({
      orgId: ctx.orgId, memoId, versionNo, subject: memo.subject,
      bodyHtml: memo.bodyHtml, editorId: ctx.user.id, submittedAt: now,
    })

    // A resubmission always resumes at the participant who asked for the changes;
    // everyone before them keeps the decision they already made.
    const resumeAt = requester ? requester.newStepNo : renumbered[0].newStepNo
    await tx.insert(workflowSteps).values(renumbered.map((s) => ({
      orgId: ctx.orgId, memoId, cycle, stepNo: s.newStepNo,
      positionTitle: s.positionTitle, assigneeUserId: s.assigneeUserId,
      requiredAction: s.requiredAction,
      outcome: (s.newStepNo < resumeAt ? s.outcome : 'pending') as typeof s.outcome,
      actedByUserId: s.newStepNo < resumeAt ? s.actedByUserId : null,
      onBehalfOfUserId: s.newStepNo < resumeAt ? s.onBehalfOfUserId : null,
      actedAt: s.newStepNo < resumeAt ? s.actedAt : null,
      comment: s.newStepNo < resumeAt ? s.comment : null,
    })))

    const target = renumbered.find((s) => s.newStepNo === resumeAt)!
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
