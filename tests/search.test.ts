import { describe, it, expect, beforeEach } from 'vitest'
import { resetDb } from './helpers/db'
import { makeOrgFixture, type OrgFixture } from './helpers/fixtures'
import { searchMemos } from '@/lib/repo/search'
import { submitMemo } from '@/lib/workflow'

let f: OrgFixture
beforeEach(async () => { await resetDb(); f = await makeOrgFixture() })

describe('searchMemos', () => {
  it("finds the author's own memo by a body term", async () => {
    const r = await searchMemos(f.authorCtx, { text: 'oscilloscopes' })
    expect(r.rows.some((m) => m.id === f.memoId)).toBe(true)
  })

  it('finds a memo by its number', async () => {
    const r = await searchMemos(f.authorCtx, { memoNumber: 'NBU-2026-0001' })
    expect(r.rows).toHaveLength(1)
  })

  it('never returns a memo from another organization', async () => {
    const r = await searchMemos(f.otherOrgCtx, { text: 'oscilloscopes' })
    expect(r.rows).toHaveLength(0)
  })

  it('never returns a memo the user is not authorized to see', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await searchMemos(f.outsiderCtx, { text: 'oscilloscopes' })
    expect(r.rows).toHaveLength(0)
  })

  it('returns a memo to a workflow participant', async () => {
    await submitMemo(f.authorCtx, f.memoId)
    const r = await searchMemos(f.directorCtx, { text: 'oscilloscopes' })
    expect(r.rows).toHaveLength(1)
  })
})
