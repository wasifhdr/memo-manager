import { describe, it, expect, beforeEach } from 'vitest'
import { resetDb } from './helpers/db'
import { makeOrgFixture, type OrgFixture } from './helpers/fixtures'
import { getMemoDetail, listInbox, listMyMemos, listCompleted, listVersions, getVersion } from '@/lib/repo/memo'
import { searchMemos } from '@/lib/repo/search'
import { listDepartments, listUsers, listCategories, listTemplates } from '@/lib/repo/org'
import { listAudit } from '@/lib/repo/audit'
import { memoReport } from '@/lib/repo/reports'
import { getMemoAccess } from '@/lib/authz'
import { submitMemo, actOnMemo, resubmitMemo, cancelMemo } from '@/lib/workflow'
import { db } from '@/lib/db'
import { memoAttachments } from '@/db/schema'

let f: OrgFixture
beforeEach(async () => { await resetDb(); f = await makeOrgFixture() })

describe('cross-tenant reads return nothing, never a partial result or a 403', () => {
  it('every memo read path returns nothing for the other organization', async () => {
    await submitMemo(f.authorCtx, f.memoId)

    expect(await getMemoDetail(f.otherOrgCtx, f.memoId)).toBeNull()
    expect(await getMemoAccess(f.otherOrgCtx, f.memoId)).toBeNull()
    expect((await listInbox(f.otherOrgCtx, {})).rows).toHaveLength(0)
    expect((await listMyMemos(f.otherOrgCtx, {})).rows).toHaveLength(0)
    expect((await listCompleted(f.otherOrgCtx, {})).rows).toHaveLength(0)
    expect((await searchMemos(f.otherOrgCtx, { text: 'oscilloscopes' })).rows).toHaveLength(0)
    expect(await listVersions(f.otherOrgCtx, f.memoId)).toBeNull()
    expect(await getVersion(f.otherOrgCtx, f.memoId, 1)).toBeNull()
  })

  it('every org-level read path is scoped to the caller\'s organization', async () => {
    expect((await listDepartments(f.otherOrgCtx)).some((d) => d.name === 'Finance')).toBe(false)
    expect((await listUsers(f.otherOrgCtx)).some((u) => u.email === 'ayesha@nbu.test')).toBe(false)
    expect((await listCategories(f.otherOrgCtx)).every((c) => c.orgId === f.otherOrgCtx.orgId)).toBe(true)
    expect((await listTemplates(f.otherOrgCtx)).every((t) => t.orgId === f.otherOrgCtx.orgId)).toBe(true)
  })

  it('the audit log and reports never leak another organization\'s data', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    // The other org's audit log must not contain this org's memo number or ID.
    const audit = await listAudit(f.otherOrgCtx, {})
    expect(audit.rows.some((r) => r.description.includes(f.memoId))).toBe(false)

    const report = await memoReport(f.otherOrgCtx, {})
    expect(report.byStatus.reduce((sum, r) => sum + r.count, 0)).toBe(0)
  })

  it('an outsider within the same organization cannot view the memo', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    expect(await getMemoDetail(f.outsiderCtx, f.memoId)).toBeNull()
    expect((await searchMemos(f.outsiderCtx, { text: 'oscilloscopes' })).rows).toHaveLength(0)
  })

  it('the attachment download route\'s access check denies a non-participant', async () => {
    await db.insert(memoAttachments).values({
      orgId: f.orgId, memoId: f.memoId, filename: 'quote.pdf', mime: 'application/pdf',
      sizeBytes: 10, data: Buffer.from('test-data'), uploadedById: f.author.id, versionNo: 1,
    })
    const outsiderAccess = await getMemoAccess(f.outsiderCtx, f.memoId)
    expect(outsiderAccess?.canView).toBe(false)
    const otherOrgAccess = await getMemoAccess(f.otherOrgCtx, f.memoId)
    expect(otherOrgAccess).toBeNull()
  })
})

describe('cross-tenant writes are refused, never applied', () => {
  it('every workflow mutation fails for a user in another organization', async () => {
    expect((await submitMemo(f.otherOrgCtx, f.memoId)).ok).toBe(false)
    await submitMemo(f.authorCtx, f.memoId)
    expect((await actOnMemo(f.otherOrgCtx, f.memoId, 'approve', null)).ok).toBe(false)
    expect((await resubmitMemo(f.otherOrgCtx, f.memoId, 'resume')).ok).toBe(false)
    expect((await cancelMemo(f.otherOrgCtx, f.memoId, 'x')).ok).toBe(false)
  })

  it('every workflow mutation fails for an outsider in the same organization', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    expect((await actOnMemo(f.outsiderCtx, f.memoId, 'approve', null)).ok).toBe(false)
    expect((await actOnMemo(f.outsiderCtx, f.memoId, 'comment', 'butting in')).ok).toBe(false)
    expect((await cancelMemo(f.outsiderCtx, f.memoId, 'mischief')).ok).toBe(false)
  })
})
