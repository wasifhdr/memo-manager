import { describe, it, expect, beforeEach } from 'vitest'
import { resetDb } from './helpers/db'
import { getMemoAccess } from '@/lib/authz'
import { submitMemo, actOnMemo } from '@/lib/workflow'
import { makeOrgFixture, type OrgFixture } from './helpers/fixtures'

let f: OrgFixture
beforeEach(async () => { await resetDb(); f = await makeOrgFixture() })

describe('getMemoAccess', () => {
  it('returns null for a memo in another organization', async () => {
    expect(await getMemoAccess(f.otherOrgCtx, f.memoId)).toBeNull()
  })

  it('denies view to an unrelated user in the same organization', async () => {
    const a = await getMemoAccess(f.outsiderCtx, f.memoId)
    expect(a?.canView).toBe(false)
  })

  it('grants view to the author, participants and admins', async () => {
    expect((await getMemoAccess(f.authorCtx, f.memoId))?.canView).toBe(true)
    expect((await getMemoAccess(f.directorCtx, f.memoId))?.canView).toBe(true)
  })

  it('grants canAct only to the current step assignee', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    expect((await getMemoAccess(f.deptHeadCtx, f.memoId))?.canAct).toBe(true)
    expect((await getMemoAccess(f.financeCtx, f.memoId))?.canAct).toBe(false)
    expect((await getMemoAccess(f.directorCtx, f.memoId))?.canAct).toBe(false)
  })

  it('reports actingForUserId for a delegate', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await f.grantDelegation(f.deptHead.id, f.delegate.id)
    const a = await getMemoAccess(f.delegateCtx, f.memoId)
    expect(a?.canAct).toBe(true)
    expect(a?.actingForUserId).toBe(f.deptHead.id)
  })

  it('lets the author edit a draft and a changes-requested memo, but not one in flight', async () => {
    expect((await getMemoAccess(f.authorCtx, f.memoId))?.canEdit).toBe(true)
    await submitMemo(f.authorCtx, f.memoId)
    expect((await getMemoAccess(f.authorCtx, f.memoId))?.canEdit).toBe(false)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Please revise')
    expect((await getMemoAccess(f.authorCtx, f.memoId))?.canEdit).toBe(true)
  })

  it('denies canAct on a step that already requested changes, until resubmission', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'request_changes', 'Please revise')
    const a = await getMemoAccess(f.deptHeadCtx, f.memoId)
    expect(a?.canAct).toBe(false)
  })

  it('denies every action once the memo is approved', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    await actOnMemo(f.deptHeadCtx, f.memoId, 'approve', null)
    await actOnMemo(f.financeCtx, f.memoId, 'approve', null)
    await actOnMemo(f.directorCtx, f.memoId, 'approve', null)
    const a = await getMemoAccess(f.directorCtx, f.memoId)
    expect(a?.canAct).toBe(false)
    expect(a?.canCancel).toBe(false)
    // The thread outlives the decisions — see the comment rule in workflow.ts.
    expect(a?.canComment).toBe(true)
  })

  it('opens the thread to the author and every participant, and nobody else', async () => {
    const draft = await getMemoAccess(f.authorCtx, f.memoId)
    expect(draft?.canComment).toBe(true)                    // still a draft

    await submitMemo(f.authorCtx, f.memoId)
    for (const ctx of [f.authorCtx, f.deptHeadCtx, f.financeCtx, f.directorCtx]) {
      expect((await getMemoAccess(ctx, f.memoId))?.canComment).toBe(true)
    }
    expect((await getMemoAccess(f.outsiderCtx, f.memoId))?.canComment).toBe(false)
  })
})
