import { describe, it, expect, beforeEach } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { memos, workflowSteps, memoEvents, notifications } from '@/db/schema'
import { and, eq, asc } from 'drizzle-orm'
import {
  submitMemo, actOnMemo, resubmitMemo, cancelMemo,
  reassignStep, addParticipant, removeParticipant,
} from '@/lib/workflow'
import { makeOrgFixture, type OrgFixture } from './helpers/fixtures'

let f: OrgFixture

beforeEach(async () => {
  await resetDb()
  f = await makeOrgFixture()
})

async function statusOf(memoId: string) {
  const [m] = await db.select().from(memos).where(eq(memos.id, memoId))
  return m.status
}

describe('submit', () => {
  it('moves a draft to pending_approval and notifies the first participant', async () => {
    const r = await submitMemo(f.authorCtx, f.memoId)
    expect(r.ok).toBe(true)
    expect(await statusOf(f.memoId)).toBe('pending_approval')

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentCycle).toBe(1)
    expect(m.currentStepNo).toBe(1)
    expect(m.currentVersion).toBe(1)
    expect(m.submittedAt).not.toBeNull()

    const notes = await db.select().from(notifications)
      .where(eq(notifications.userId, f.deptHead.id))
    expect(notes.some((n) => n.type === 'action_required')).toBe(true)
  })

  it('refuses to submit a memo with no participants', async () => {
    await db.delete(workflowSteps).where(eq(workflowSteps.memoId, f.memoId))
    const r = await submitMemo(f.authorCtx, f.memoId)
    expect(r.ok).toBe(false)
  })

  it('refuses submission by anyone but the author', async () => {
    const r = await submitMemo(f.deptHeadCtx, f.memoId)
    expect(r.ok).toBe(false)
  })
})

describe('sequence enforcement', () => {
  beforeEach(async () => { await submitMemo(f.authorCtx, f.memoId) })

  it('lets the current participant approve and advances to the next', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', 'Looks fine')
    expect(r.ok).toBe(true)
    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(2)
    expect(m.status).toBe('pending_approval')
  })

  it('refuses an approval from a later participant while an earlier step is pending', async () => {
    const r = await actOnMemo(f.directorCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
    expect(await statusOf(f.memoId)).toBe('pending_approval')
    const [step1] = await db.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.stepNo, 1)))
    expect(step1.outcome).toBe('pending')
  })

  it('refuses an action from a user who is not in the workflow at all', async () => {
    const r = await actOnMemo(f.outsiderCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
  })

  it('refuses an action from another organization entirely', async () => {
    const r = await actOnMemo(f.otherOrgCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
  })
})

describe('completion', () => {
  it('marks the memo approved once the final participant approves', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    await actOnMemo(f.financeCtx, f.memoId, 'approve', null)
    const r = await actOnMemo(f.directorCtx, f.memoId, 'approve', 'Approved')
    expect(r.ok).toBe(true)

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.status).toBe('approved')
    expect(m.finalApproverId).toBe(f.director.id)
    expect(m.completedAt).not.toBeNull()

    const evs = await db.select().from(memoEvents)
      .where(eq(memoEvents.memoId, f.memoId)).orderBy(asc(memoEvents.createdAt))
    expect(evs.at(-1)?.type).toBe('completed')
  })

  it('makes an approved memo read-only to further workflow actions', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    await actOnMemo(f.financeCtx, f.memoId, 'approve', null)
    await actOnMemo(f.directorCtx, f.memoId, 'approve', null)
    const r = await actOnMemo(f.directorCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
  })
})

describe('rejection', () => {
  beforeEach(async () => { await submitMemo(f.authorCtx, f.memoId) })

  it('requires a reason', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'reject', null)
    expect(r.ok).toBe(false)
    expect(await statusOf(f.memoId)).toBe('pending_approval')
  })

  it('terminates the workflow and skips remaining steps', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'reject', 'Budget not available')
    expect(r.ok).toBe(true)
    expect(await statusOf(f.memoId)).toBe('rejected')

    const steps = await db.select().from(workflowSteps)
      .where(eq(workflowSteps.memoId, f.memoId)).orderBy(asc(workflowSteps.stepNo))
    expect(steps[0].outcome).toBe('rejected')
    expect(steps[1].outcome).toBe('skipped')
    expect(steps[2].outcome).toBe('skipped')
  })
})

describe('request changes and resubmission', () => {
  beforeEach(async () => { await submitMemo(f.authorCtx, f.memoId) })

  it('requires a comment', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', '')
    expect(r.ok).toBe(false)
  })

  it('returns the memo to the author', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Add the quotation')
    expect(await statusOf(f.memoId)).toBe('changes_requested')
    const notes = await db.select().from(notifications)
      .where(eq(notifications.userId, f.author.id))
    expect(notes.some((n) => n.type === 'changes_requested')).toBe(true)
  })

  it('resubmission returns to the participant who asked for changes', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)          // step 1 done
    await actOnMemo(f.financeCtx, f.memoId, 'request_changes', 'Fix the total')
    const r = await resubmitMemo(f.authorCtx, f.memoId)
    expect(r.ok).toBe(true)

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentCycle).toBe(2)
    expect(m.currentStepNo).toBe(2)          // back at Finance, not at Dept Head
    expect(m.currentVersion).toBe(2)
    expect(m.status).toBe('pending_approval')

    const c2step1 = await db.select().from(workflowSteps).where(and(
      eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 2), eq(workflowSteps.stepNo, 1),
    ))
    expect(c2step1[0].outcome).toBe('approved')   // carried forward
  })

  it('goes back to the first participant when they were the one who asked', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Fix the total')
    await resubmitMemo(f.authorCtx, f.memoId)

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(1)
    const c2step1 = await db.select().from(workflowSteps).where(and(
      eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 2), eq(workflowSteps.stepNo, 1),
    ))
    expect(c2step1[0].outcome).toBe('pending')
  })

  it('keeps every previous version and every previous cycle', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Rework')
    await resubmitMemo(f.authorCtx, f.memoId)
    const cycle1 = await db.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 1)))
    expect(cycle1).toHaveLength(3)
    expect(cycle1.find((s) => s.stepNo === 1)?.outcome).toBe('changes_requested')
  })

  it('refuses resubmission by anyone but the author', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Rework')
    const r = await resubmitMemo(f.deptHeadCtx, f.memoId)
    expect(r.ok).toBe(false)
  })

  it('refuses a second decision on the same step once changes were requested', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Rework')
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
    expect(await statusOf(f.memoId)).toBe('changes_requested')

    const [step1] = await db.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 1), eq(workflowSteps.stepNo, 1)))
    expect(step1.outcome).toBe('changes_requested')
  })
})

describe('comments', () => {
  it('lets a participant comment without advancing the workflow', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await actOnMemo(f.directorCtx, f.memoId, 'comment', 'Noting my view early')
    expect(r.ok).toBe(true)
    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(1)
    expect(m.status).toBe('pending_approval')
  })

  it('refuses a comment from a non-participant', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await actOnMemo(f.outsiderCtx, f.memoId, 'comment', 'butting in')
    expect(r.ok).toBe(false)
  })
})

describe('delegation', () => {
  it('lets an active delegate act and records both identities', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await f.grantDelegation(f.deptHead.id, f.delegate.id)
    const r = await actOnMemo(f.delegateCtx, f.memoId, 'approve', 'Approved while Head is away')
    expect(r.ok).toBe(true)

    const [step] = await db.select().from(workflowSteps).where(and(
      eq(workflowSteps.memoId, f.memoId), eq(workflowSteps.cycle, 1), eq(workflowSteps.stepNo, 1),
    ))
    expect(step.actedByUserId).toBe(f.delegate.id)
    expect(step.onBehalfOfUserId).toBe(f.deptHead.id)
  })

  it('refuses an expired delegation', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await f.grantDelegation(f.deptHead.id, f.delegate.id, { expired: true })
    const r = await actOnMemo(f.delegateCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(false)
  })
})

describe('cancellation', () => {
  it('lets the author cancel an in-progress memo', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await cancelMemo(f.authorCtx, f.memoId, 'No longer needed')
    expect(r.ok).toBe(true)
    expect(await statusOf(f.memoId)).toBe('cancelled')
  })

  it('refuses cancellation by an unrelated user', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await cancelMemo(f.outsiderCtx, f.memoId, 'mischief')
    expect(r.ok).toBe(false)
  })
})

describe('re-routing while the memo is in flight', () => {
  beforeEach(async () => { await submitMemo(f.authorCtx, f.memoId) })

  async function stepsOf(memoId: string, cycle = 1) {
    return db.select().from(workflowSteps)
      .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, cycle)))
      .orderBy(asc(workflowSteps.stepNo))
  }

  it('approve-and-forward slots the newcomer in before the original next step', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null,
      { userId: f.outsider.id, positionTitle: 'Legal' })
    expect(r.ok).toBe(true)

    const steps = await stepsOf(f.memoId)
    expect(steps.map((s) => s.assigneeUserId)).toEqual([
      f.deptHead.id, f.outsider.id, f.finance.id, f.director.id,
    ])
    expect(steps.map((s) => s.stepNo)).toEqual([1, 2, 3, 4])

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(2)                  // sitting with the newcomer

    const notes = await db.select().from(notifications)
      .where(eq(notifications.userId, f.outsider.id))
    expect(notes.some((n) => n.type === 'action_required')).toBe(true)
  })

  it('the forwarded person hands it back to the original queue on approval', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null, { userId: f.outsider.id, positionTitle: 'Legal' })
    const r = await actOnMemo(f.outsiderCtx, f.memoId, 'approve', null)
    expect(r.ok).toBe(true)

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    const steps = await stepsOf(f.memoId)
    expect(steps.find((s) => s.stepNo === m.currentStepNo)?.assigneeUserId).toBe(f.finance.id)
  })

  it('the forwarded person can re-route in turn', async () => {
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null, { userId: f.outsider.id, positionTitle: 'Legal' })
    const steps = await stepsOf(f.memoId)
    const director = steps.find((s) => s.assigneeUserId === f.director.id)!

    expect((await removeParticipant(f.outsiderCtx, f.memoId, director.id)).ok).toBe(true)
    const after = await stepsOf(f.memoId)
    expect(after.find((s) => s.id === director.id)?.outcome).toBe('skipped')
  })

  it('refuses to forward to someone already waiting in the queue', async () => {
    const r = await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null,
      { userId: f.director.id, positionTitle: null })
    expect(r.ok).toBe(false)
    const steps = await stepsOf(f.memoId)
    expect(steps).toHaveLength(3)                    // nothing was written
    expect(steps[0].outcome).toBe('pending')
  })

  it('declining hands the seat over without recording a decision', async () => {
    const steps = await stepsOf(f.memoId)
    const mine = steps[0]
    const r = await reassignStep(f.deptHeadCtx, f.memoId, mine.id, f.outsider.id, 'Acting Head', 'Not my call')
    expect(r.ok).toBe(true)

    const after = await stepsOf(f.memoId)
    expect(after[0].assigneeUserId).toBe(f.outsider.id)
    expect(after[0].positionTitle).toBe('Acting Head')
    expect(after[0].outcome).toBe('pending')         // no decision was made
    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(1)
    expect(m.status).toBe('pending_approval')
  })

  it('lets the replacement act, and refuses the person who handed over', async () => {
    const steps = await stepsOf(f.memoId)
    await reassignStep(f.deptHeadCtx, f.memoId, steps[0].id, f.outsider.id, null, null)

    expect((await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)).ok).toBe(false)
    expect((await actOnMemo(f.outsiderCtx, f.memoId, 'approve', null)).ok).toBe(true)
  })

  it('the author may reassign the seat holding the memo; a bystander may not', async () => {
    const steps = await stepsOf(f.memoId)
    expect((await reassignStep(f.outsiderCtx, f.memoId, steps[0].id, f.delegate.id, null, null)).ok).toBe(false)
    expect((await reassignStep(f.authorCtx, f.memoId, steps[0].id, f.delegate.id, null, null)).ok).toBe(true)
    const after = await stepsOf(f.memoId)
    expect(after[0].assigneeUserId).toBe(f.delegate.id)
  })

  it('a participant may only hand over the seat they are holding', async () => {
    const steps = await stepsOf(f.memoId)
    const director = steps.find((s) => s.assigneeUserId === f.director.id)!
    const r = await reassignStep(f.deptHeadCtx, f.memoId, director.id, f.outsider.id, null, null)
    expect(r.ok).toBe(false)
  })

  it('adds a participant after a chosen step and renumbers the tail', async () => {
    const r = await addParticipant(f.authorCtx, f.memoId, {
      afterStepNo: 2, userId: f.outsider.id, positionTitle: 'Registrar',
    })
    expect(r.ok).toBe(true)

    const steps = await stepsOf(f.memoId)
    expect(steps.map((s) => s.stepNo)).toEqual([1, 2, 3, 4])
    expect(steps.map((s) => s.assigneeUserId)).toEqual([
      f.deptHead.id, f.finance.id, f.outsider.id, f.director.id,
    ])
  })

  it('refuses to add someone before the step holding the memo', async () => {
    const r = await addParticipant(f.authorCtx, f.memoId, {
      afterStepNo: 0, userId: f.outsider.id, positionTitle: null,
    })
    expect(r.ok).toBe(false)
  })

  it('removing keeps the row as skipped and names who took them out', async () => {
    const steps = await stepsOf(f.memoId)
    const finance = steps.find((s) => s.assigneeUserId === f.finance.id)!
    expect((await removeParticipant(f.deptHeadCtx, f.memoId, finance.id)).ok).toBe(true)

    const after = await stepsOf(f.memoId)
    const removed = after.find((s) => s.id === finance.id)!
    expect(removed.outcome).toBe('skipped')
    expect(removed.actedByUserId).toBe(f.deptHead.id)
    expect(after).toHaveLength(3)                    // the row is kept, not deleted
  })

  it('a removed participant is skipped over when the memo advances', async () => {
    const steps = await stepsOf(f.memoId)
    const finance = steps.find((s) => s.assigneeUserId === f.finance.id)!
    await removeParticipant(f.deptHeadCtx, f.memoId, finance.id)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)

    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    const after = await stepsOf(f.memoId)
    expect(after.find((s) => s.stepNo === m.currentStepNo)?.assigneeUserId).toBe(f.director.id)
  })

  it('refuses to remove the step holding the memo, or one that already acted', async () => {
    const steps = await stepsOf(f.memoId)
    expect((await removeParticipant(f.deptHeadCtx, f.memoId, steps[0].id)).ok).toBe(false)

    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)   // step 1 decided
    expect((await removeParticipant(f.financeCtx, f.memoId, steps[0].id)).ok).toBe(false)
  })

  it('leaves at least one participant to decide', async () => {
    const steps = await stepsOf(f.memoId)
    const finance = steps.find((s) => s.assigneeUserId === f.finance.id)!
    const director = steps.find((s) => s.assigneeUserId === f.director.id)!
    await removeParticipant(f.deptHeadCtx, f.memoId, finance.id)
    await removeParticipant(f.deptHeadCtx, f.memoId, director.id)

    // Only the seat holding the memo is left, and it cannot be removed.
    expect((await removeParticipant(f.deptHeadCtx, f.memoId, steps[0].id)).ok).toBe(false)
    expect((await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)).ok).toBe(true)
    expect(await statusOf(f.memoId)).toBe('approved')
  })

  it('refuses re-routing once the memo is no longer waiting on anyone', async () => {
    const steps = await stepsOf(f.memoId)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Rework')
    expect((await removeParticipant(f.authorCtx, f.memoId, steps[1].id)).ok).toBe(false)
    expect((await addParticipant(f.authorCtx, f.memoId, {
      afterStepNo: 1, userId: f.outsider.id, positionTitle: null,
    })).ok).toBe(false)
  })

  it('a removed participant does not come back in the next cycle', async () => {
    const steps = await stepsOf(f.memoId)
    const finance = steps.find((s) => s.assigneeUserId === f.finance.id)!
    await removeParticipant(f.deptHeadCtx, f.memoId, finance.id)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    await actOnMemo(f.directorCtx, f.memoId, 'request_changes', 'Rework')
    await resubmitMemo(f.authorCtx, f.memoId)

    const cycle2 = await stepsOf(f.memoId, 2)
    expect(cycle2.map((s) => s.assigneeUserId)).toEqual([f.deptHead.id, f.director.id])
    expect(cycle2.map((s) => s.stepNo)).toEqual([1, 2])          // renumbered, no gap
    const [m] = await db.select().from(memos).where(eq(memos.id, f.memoId))
    expect(m.currentStepNo).toBe(2)                              // back at the Director
  })
})
