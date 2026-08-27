import { and, count, eq, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memos, departments, memoCategories, type MemoStatus } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export type ReportFilters = {
  from?: Date
  to?: Date
  departmentId?: string
  categoryId?: string
  status?: MemoStatus
}

function filterClauses(ctx: TenantContext, f: ReportFilters) {
  const clauses = [eq(memos.orgId, ctx.orgId)]
  if (f.from) clauses.push(gte(memos.createdAt, f.from))
  if (f.to) clauses.push(lte(memos.createdAt, f.to))
  if (f.departmentId) clauses.push(eq(memos.departmentId, f.departmentId))
  if (f.categoryId) clauses.push(eq(memos.categoryId, f.categoryId))
  if (f.status) clauses.push(eq(memos.status, f.status))
  return clauses
}

/** Org-wide statistics for the admin reports page. §19. Callers gate behind requireAdmin(). */
export async function memoReport(ctx: TenantContext, f: ReportFilters) {
  const where = and(...filterClauses(ctx, f))

  const [byStatus, byDepartment, byCategory] = await Promise.all([
    db.select({ status: memos.status, n: count() }).from(memos).where(where).groupBy(memos.status),
    db.select({ department: departments.name, n: count() }).from(memos)
      .leftJoin(departments, eq(departments.id, memos.departmentId))
      .where(where).groupBy(departments.name),
    db.select({ category: memoCategories.name, n: count() }).from(memos)
      .leftJoin(memoCategories, eq(memoCategories.id, memos.categoryId))
      .where(where).groupBy(memoCategories.name),
  ])

  const [{ n: urgentCount }] = await db.select({ n: count() }).from(memos)
    .where(and(where, eq(memos.priority, 'urgent')))
  const [{ n: pendingApprovals }] = await db.select({ n: count() }).from(memos)
    .where(and(where, eq(memos.status, 'pending_approval')))
  const [{ n: rejectedCount }] = await db.select({ n: count() }).from(memos)
    .where(and(where, eq(memos.status, 'rejected')))
  const [{ n: changeRequestCount }] = await db.select({ n: count() }).from(memos)
    .where(and(where, eq(memos.status, 'changes_requested')))

  const [{ avg }] = await db.select({
    avg: sql<number | null>`avg(extract(epoch from (${memos.completedAt} - ${memos.submittedAt})) / 3600)
      filter (where ${memos.status} = 'approved' and ${memos.completedAt} is not null)`,
  }).from(memos).where(where)

  return {
    byStatus: byStatus.map((r) => ({ status: r.status, count: r.n })),
    byDepartment: byDepartment.map((r) => ({ department: r.department ?? 'Unassigned', count: r.n })),
    byCategory: byCategory.map((r) => ({ category: r.category ?? 'Uncategorized', count: r.n })),
    urgentCount, pendingApprovals, rejectedCount, changeRequestCount,
    avgCompletionHours: avg != null ? Number(avg) : null,
  }
}
