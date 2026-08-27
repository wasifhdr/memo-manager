import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { organizations, users, departments, memoCategories } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createOrganization } from '@/lib/org-setup'

beforeAll(async () => { await resetDb() })

describe('createOrganization', () => {
  it('creates the org, its first admin, and starter data', async () => {
    const r = await createOrganization({
      orgName: 'Northbridge University', orgCode: 'NBU',
      adminName: 'Ayesha Rahman', adminEmail: 'ayesha@nbu.test',
      password: 'correct horse battery',
    })
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const [org] = await db.select().from(organizations).where(eq(organizations.id, r.orgId))
    expect(org.slug).toBe('northbridge-university')

    const admins = await db.select().from(users).where(eq(users.orgId, r.orgId))
    expect(admins).toHaveLength(1)
    expect(admins[0].role).toBe('org_admin')
    expect(admins[0].passwordHash).not.toBe('correct horse battery')

    const cats = await db.select().from(memoCategories).where(eq(memoCategories.orgId, r.orgId))
    expect(cats.map((c) => c.name)).toContain('Administrative')

    const depts = await db.select().from(departments).where(eq(departments.orgId, r.orgId))
    expect(depts.length).toBeGreaterThan(0)
  })

  it('rejects a duplicate organization slug', async () => {
    const again = await createOrganization({
      orgName: 'Northbridge University', orgCode: 'NBU2',
      adminName: 'Someone', adminEmail: 'x@nbu.test', password: 'another password',
    })
    expect(again.ok).toBe(false)
  })
})
