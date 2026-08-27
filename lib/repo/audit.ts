import 'server-only'
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { auditLog, users } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export type AuditFilters = {
  eventType?: string
  actorId?: string
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 50

/** Org-scoped, read-only. Callers gate this behind requireAdmin(). */
export async function listAudit(ctx: TenantContext, f: AuditFilters) {
  const pageSize = f.pageSize && f.pageSize > 0 ? Math.min(f.pageSize, 200) : DEFAULT_PAGE_SIZE
  const page = f.page && f.page > 0 ? f.page : 1
  const offset = (page - 1) * pageSize

  const clauses = [eq(auditLog.orgId, ctx.orgId)]
  if (f.eventType) clauses.push(eq(auditLog.eventType, f.eventType))
  if (f.actorId) clauses.push(eq(auditLog.actorId, f.actorId))
  if (f.from) clauses.push(gte(auditLog.createdAt, f.from))
  if (f.to) clauses.push(lte(auditLog.createdAt, f.to))
  const where = and(...clauses)

  const actor = alias(users, 'audit_actor')
  const rows = await db.select({
    id: auditLog.id, eventType: auditLog.eventType, description: auditLog.description,
    entityType: auditLog.entityType, entityId: auditLog.entityId,
    actorName: actor.name, createdAt: auditLog.createdAt,
  }).from(auditLog)
    .leftJoin(actor, eq(actor.id, auditLog.actorId))
    .where(where)
    .orderBy(desc(auditLog.createdAt))
    .limit(pageSize).offset(offset)

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(auditLog).where(where)

  return { rows, total: count }
}

/** Distinct event types seen for this org, for the filter dropdown. */
export async function listAuditEventTypes(ctx: TenantContext): Promise<string[]> {
  const rows = await db.selectDistinct({ eventType: auditLog.eventType }).from(auditLog)
    .where(eq(auditLog.orgId, ctx.orgId))
    .orderBy(auditLog.eventType)
  return rows.map((r) => r.eventType)
}
