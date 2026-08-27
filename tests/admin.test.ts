import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { createOrganization } from '@/lib/org-setup'
import { listDepartments, listUsers, listCategories } from '@/lib/repo/org'
import type { TenantContext } from '@/lib/tenant'
import { db } from '@/lib/db'
import { users, departments } from '@/db/schema'
import { eq } from 'drizzle-orm'

let a: TenantContext
let b: TenantContext

async function ctxFor(orgId: string, userId: string): Promise<TenantContext> {
  const [u] = await db.select().from(users).where(eq(users.id, userId))
  return { orgId, user: { ...u } }
}

beforeAll(async () => {
  await resetDb()
  const ra = await createOrganization({
    orgName: 'Northbridge University', orgCode: 'NBU',
    adminName: 'Ayesha', adminEmail: 'ayesha@nbu.test', password: 'password-one-x',
  })
  const rb = await createOrganization({
    orgName: 'Aurora Logistics', orgCode: 'AUR',
    adminName: 'Tanvir', adminEmail: 'tanvir@aurora.test', password: 'password-two-x',
  })
  if (!ra.ok || !rb.ok) throw new Error('setup failed')
  a = await ctxFor(ra.orgId, ra.userId)
  b = await ctxFor(rb.orgId, rb.userId)
})

describe('tenant isolation of admin reads', () => {
  it('lists only its own departments', async () => {
    await db.insert(departments).values({ orgId: a.orgId, name: 'Finance' })
    const forA = await listDepartments(a)
    const forB = await listDepartments(b)
    expect(forA.some((d) => d.name === 'Finance')).toBe(true)
    expect(forB.some((d) => d.name === 'Finance')).toBe(false)
  })

  it('lists only its own users', async () => {
    const forB = await listUsers(b)
    expect(forB.every((u) => u.orgId === b.orgId)).toBe(true)
    expect(forB.some((u) => u.email === 'ayesha@nbu.test')).toBe(false)
  })

  it('lists only its own categories', async () => {
    const forA = await listCategories(a)
    expect(forA.every((c) => c.orgId === a.orgId)).toBe(true)
  })
})
