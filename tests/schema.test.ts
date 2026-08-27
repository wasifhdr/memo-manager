import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { organizations, departments, users } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('schema', () => {
  beforeAll(async () => { await resetDb() })

  it('stores an organization with a department and a user', async () => {
    const [org] = await db.insert(organizations)
      .values({ name: 'Northbridge University', slug: 'northbridge', code: 'NBU' })
      .returning()

    const [dept] = await db.insert(departments)
      .values({ orgId: org.id, name: 'Finance' }).returning()

    const [user] = await db.insert(users).values({
      orgId: org.id, name: 'Ayesha Rahman', email: 'ayesha@nbu.test',
      departmentId: dept.id, role: 'org_admin', passwordHash: 'x',
    }).returning()

    expect(user.orgId).toBe(org.id)
    expect(user.status).toBe('active')
    expect(org.config.memoPrefix).toBe('MEMO')

    const found = await db.select().from(users).where(eq(users.orgId, org.id))
    expect(found).toHaveLength(1)
  })

  it('rejects a duplicate email inside one organization', async () => {
    const [org] = await db.insert(organizations)
      .values({ name: 'Aurora Logistics', slug: 'aurora', code: 'AUR' }).returning()
    const row = { orgId: org.id, name: 'A', email: 'dup@aurora.test', passwordHash: 'x' }
    await db.insert(users).values(row)
    await expect(db.insert(users).values(row)).rejects.toThrow()
  })
})
