import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { sanitizeMemoHtml } from '@/lib/sanitize'
import { nextMemoNumber } from '@/lib/memo-number'
import { organizations } from '@/db/schema'

let orgId: string
beforeAll(async () => {
  await resetDb()
  const [org] = await db.insert(organizations)
    .values({ name: 'NBU', slug: 'nbu', code: 'NBU' }).returning()
  orgId = org.id
})

describe('sanitizeMemoHtml', () => {
  it('keeps basic formatting', () => {
    const out = sanitizeMemoHtml('<p>Hello <strong>team</strong></p><ul><li>one</li></ul>')
    expect(out).toContain('<strong>team</strong>')
    expect(out).toContain('<li>one</li>')
  })

  it('strips script tags and inline handlers', () => {
    const out = sanitizeMemoHtml('<p onclick="steal()">hi</p><script>alert(1)</script>')
    expect(out).not.toContain('script')
    expect(out).not.toContain('onclick')
    expect(out).toContain('hi')
  })

  it('strips javascript: hrefs', () => {
    const out = sanitizeMemoHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })
})

describe('nextMemoNumber', () => {
  it('increments per organization and never repeats under concurrency', async () => {
    const first = await nextMemoNumber(db, orgId, 'NBU')
    const second = await nextMemoNumber(db, orgId, 'NBU')
    expect(first).not.toBe(second)
    expect(first).toMatch(/^NBU-\d{4}-\d{4}$/)

    const batch = await Promise.all(
      Array.from({ length: 20 }, () => nextMemoNumber(db, orgId, 'NBU')),
    )
    expect(new Set(batch).size).toBe(20)
  })
})
