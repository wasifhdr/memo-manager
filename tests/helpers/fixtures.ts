import { db } from '@/lib/db'
import {
  organizations, users, departments, memos, workflowSteps, delegations, memoCounters,
} from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'
import type { SessionUser } from '@/lib/auth'

// These fixtures build TenantContext objects directly in memory (see ctxOf)
// and never authenticate through lib/auth.ts, so the password hash column
// is unused filler — a real bcrypt hash here would just slow every test down.
const UNUSED_PASSWORD_HASH = 'not-a-real-hash-unused-by-these-fixtures'

function ctxOf(u: SessionUser): TenantContext { return { orgId: u.orgId, user: u } }

export type OrgFixture = {
  orgId: string
  memoId: string
  author: SessionUser; deptHead: SessionUser; finance: SessionUser
  director: SessionUser; outsider: SessionUser; delegate: SessionUser
  otherOrgUser: SessionUser
  authorCtx: TenantContext; deptHeadCtx: TenantContext; financeCtx: TenantContext
  directorCtx: TenantContext; outsiderCtx: TenantContext; delegateCtx: TenantContext
  otherOrgCtx: TenantContext
  grantDelegation(delegatorId: string, delegateId: string, o?: { expired?: boolean }): Promise<void>
}

async function mkUser(orgId: string, deptId: string, name: string, email: string) {
  const [u] = await db.insert(users).values({
    orgId, departmentId: deptId, name, email,
    passwordHash: UNUSED_PASSWORD_HASH,
  }).returning()
  return {
    id: u.id, orgId: u.orgId, name: u.name, email: u.email, role: u.role,
    status: u.status, departmentId: u.departmentId, designation: u.designation,
    mustChangePassword: u.mustChangePassword,
  } satisfies SessionUser
}

export async function makeOrgFixture(): Promise<OrgFixture> {
  const [org] = await db.insert(organizations)
    .values({ name: 'Northbridge University', slug: 'nbu', code: 'NBU' }).returning()
  const [dept] = await db.insert(departments)
    .values({ orgId: org.id, name: 'Finance' }).returning()

  const author = await mkUser(org.id, dept.id, 'Ayesha Rahman', 'ayesha@nbu.test')
  const deptHead = await mkUser(org.id, dept.id, 'Karim Uddin', 'karim@nbu.test')
  const finance = await mkUser(org.id, dept.id, 'Nadia Haque', 'nadia@nbu.test')
  const director = await mkUser(org.id, dept.id, 'Imran Chowdhury', 'imran@nbu.test')
  const outsider = await mkUser(org.id, dept.id, 'Sabrina Islam', 'sabrina@nbu.test')
  const delegate = await mkUser(org.id, dept.id, 'Rafi Ahmed', 'rafi@nbu.test')

  const [other] = await db.insert(organizations)
    .values({ name: 'Aurora Logistics', slug: 'aurora', code: 'AUR' }).returning()
  const [otherDept] = await db.insert(departments)
    .values({ orgId: other.id, name: 'Ops' }).returning()
  const otherOrgUser = await mkUser(other.id, otherDept.id, 'Tanvir Alam', 'tanvir@aurora.test')

  await db.insert(memoCounters).values({ orgId: org.id, year: new Date().getUTCFullYear(), seq: 0 })
  const [memo] = await db.insert(memos).values({
    orgId: org.id, memoNumber: 'NBU-2026-0001', subject: 'Laboratory equipment purchase',
    bodyHtml: '<p>Requesting approval to purchase two oscilloscopes.</p>',
    authorId: author.id, departmentId: dept.id, priority: 'high', status: 'draft',
  }).returning()

  await db.insert(workflowSteps).values(
    [deptHead, finance, director].map((u, i) => ({
      orgId: org.id, memoId: memo.id, cycle: 1, stepNo: i + 1,
      positionTitle: ['Department Head', 'Finance Manager', 'Director'][i],
      assigneeUserId: u.id, requiredAction: 'approve' as const, outcome: 'pending' as const,
    })),
  )

  return {
    orgId: org.id, memoId: memo.id,
    author, deptHead, finance, director, outsider, delegate, otherOrgUser,
    authorCtx: ctxOf(author), deptHeadCtx: ctxOf(deptHead), financeCtx: ctxOf(finance),
    directorCtx: ctxOf(director), outsiderCtx: ctxOf(outsider), delegateCtx: ctxOf(delegate),
    otherOrgCtx: ctxOf(otherOrgUser),
    async grantDelegation(delegatorId, delegateId, o) {
      const now = Date.now()
      await db.insert(delegations).values({
        orgId: org.id, delegatorId, delegateId,
        startAt: new Date(now - 86400000),
        endAt: new Date(o?.expired ? now - 3600000 : now + 86400000),
        status: 'active',
      })
    },
  }
}
