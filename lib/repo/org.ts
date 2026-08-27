import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { departments, memoCategories, users, organizations, workflowTemplates, workflowTemplateSteps } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export async function getOrganization(ctx: TenantContext) {
  const [org] = await db.select().from(organizations)
    .where(eq(organizations.id, ctx.orgId)).limit(1)
  return org
}

export async function listDepartments(ctx: TenantContext, opts?: { activeOnly?: boolean }) {
  return db.select().from(departments).where(
    opts?.activeOnly
      ? and(eq(departments.orgId, ctx.orgId), eq(departments.active, true))
      : eq(departments.orgId, ctx.orgId),
  ).orderBy(asc(departments.name))
}

export async function listCategories(ctx: TenantContext, opts?: { activeOnly?: boolean }) {
  return db.select().from(memoCategories).where(
    opts?.activeOnly
      ? and(eq(memoCategories.orgId, ctx.orgId), eq(memoCategories.active, true))
      : eq(memoCategories.orgId, ctx.orgId),
  ).orderBy(asc(memoCategories.name))
}

export async function listUsers(ctx: TenantContext) {
  return db.select({
    id: users.id, orgId: users.orgId, name: users.name, email: users.email,
    designation: users.designation, role: users.role, status: users.status,
    departmentId: users.departmentId, departmentName: departments.name,
    lastLoginAt: users.lastLoginAt, createdAt: users.createdAt,
  }).from(users)
    .leftJoin(departments, eq(departments.id, users.departmentId))
    .where(eq(users.orgId, ctx.orgId))
    .orderBy(asc(users.name))
}

export async function listActiveUsers(ctx: TenantContext) {
  return db.select({ id: users.id, name: users.name, designation: users.designation })
    .from(users)
    .where(and(eq(users.orgId, ctx.orgId), eq(users.status, 'active')))
    .orderBy(asc(users.name))
}

export async function listTemplates(ctx: TenantContext, opts?: { activeOnly?: boolean }) {
  return db.select().from(workflowTemplates).where(
    opts?.activeOnly
      ? and(eq(workflowTemplates.orgId, ctx.orgId), eq(workflowTemplates.active, true))
      : eq(workflowTemplates.orgId, ctx.orgId),
  ).orderBy(asc(workflowTemplates.name))
}

export async function getTemplateSteps(ctx: TenantContext, templateId: string) {
  return db.select().from(workflowTemplateSteps)
    .where(and(eq(workflowTemplateSteps.templateId, templateId), eq(workflowTemplateSteps.orgId, ctx.orgId)))
    .orderBy(asc(workflowTemplateSteps.stepNo))
}

/** Active templates with their ordered steps embedded — used by the memo
 * participant picker to prefill positions without a client round-trip. */
export async function listTemplatesWithSteps(ctx: TenantContext) {
  const templates = await listTemplates(ctx, { activeOnly: true })
  const steps = await db.select().from(workflowTemplateSteps)
    .where(eq(workflowTemplateSteps.orgId, ctx.orgId))
    .orderBy(asc(workflowTemplateSteps.stepNo))

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    steps: steps
      .filter((s) => s.templateId === t.id)
      .map((s) => ({ positionTitle: s.positionTitle, requiredAction: s.requiredAction })),
  }))
}

/** Every template — active and inactive — with steps, for admin management. */
export async function listAllTemplatesWithSteps(ctx: TenantContext) {
  const templates = await listTemplates(ctx)
  const steps = await db.select().from(workflowTemplateSteps)
    .where(eq(workflowTemplateSteps.orgId, ctx.orgId))
    .orderBy(asc(workflowTemplateSteps.stepNo))

  return templates.map((t) => ({
    id: t.id, name: t.name, description: t.description, active: t.active,
    steps: steps
      .filter((s) => s.templateId === t.id)
      .map((s) => ({ positionTitle: s.positionTitle, requiredAction: s.requiredAction })),
  }))
}
