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

/**
 * Every designation in use across the organization, for the position pickers
 * in workflows and templates.
 *
 * Designations are compared case-insensitively — "team lead" and "Team Lead"
 * are one entry — and the spelling shown is the one most people are recorded
 * with, so the list follows whatever convention the organization actually uses.
 */
export async function listDesignations(ctx: TenantContext): Promise<string[]> {
  const rows = await db.select({ designation: users.designation }).from(users)
    .where(eq(users.orgId, ctx.orgId))

  const spellings = new Map<string, Map<string, number>>()
  for (const { designation } of rows) {
    const label = designation?.trim()
    if (!label) continue
    const key = label.toLowerCase()
    const counts = spellings.get(key) ?? new Map<string, number>()
    counts.set(label, (counts.get(label) ?? 0) + 1)
    spellings.set(key, counts)
  }

  return [...spellings.values()]
    .map((counts) => [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0])
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
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
