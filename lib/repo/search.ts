import { and, asc, desc, eq, exists, gte, ilike, inArray, lte, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { memos, workflowSteps, departments, memoCategories, users, type MemoStatus, type Priority } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'
import { activeDelegatorIds } from '@/lib/authz'

export type SearchQuery = {
  text?: string
  memoNumber?: string
  authorId?: string
  departmentId?: string
  categoryId?: string
  status?: MemoStatus
  priority?: Priority
  from?: Date
  to?: Date
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 25

/**
 * Search within the caller's authorized organizational data — every result
 * is scoped by org AND by the same visibility rule as canViewMemo (author,
 * an org admin, or a participant in any cycle). §11.
 */
export async function searchMemos(ctx: TenantContext, q: SearchQuery) {
  const pageSize = q.pageSize && q.pageSize > 0 ? Math.min(q.pageSize, 100) : DEFAULT_PAGE_SIZE
  const page = q.page && q.page > 0 ? q.page : 1
  const offset = (page - 1) * pageSize

  const delegators = await activeDelegatorIds(ctx, ctx.user.id)
  const actsFor = [ctx.user.id, ...delegators]

  const visibility = ctx.user.role === 'org_admin'
    ? undefined
    : or(
        eq(memos.authorId, ctx.user.id),
        exists(db.select({ one: sql`1` }).from(workflowSteps)
          .where(and(eq(workflowSteps.memoId, memos.id), inArray(workflowSteps.assigneeUserId, actsFor)))),
      )

  const clauses = [eq(memos.orgId, ctx.orgId), visibility]
  if (q.text?.trim()) {
    clauses.push(sql`to_tsvector('english', ${memos.subject} || ' ' || ${memos.bodyHtml})
      @@ plainto_tsquery('english', ${q.text.trim()})`)
  }
  if (q.memoNumber?.trim()) clauses.push(ilike(memos.memoNumber, `%${q.memoNumber.trim()}%`))
  if (q.authorId) clauses.push(eq(memos.authorId, q.authorId))
  if (q.departmentId) clauses.push(eq(memos.departmentId, q.departmentId))
  if (q.categoryId) clauses.push(eq(memos.categoryId, q.categoryId))
  if (q.status) clauses.push(eq(memos.status, q.status))
  if (q.priority) clauses.push(eq(memos.priority, q.priority))
  if (q.from) clauses.push(gte(memos.createdAt, q.from))
  if (q.to) clauses.push(lte(memos.createdAt, q.to))

  const where = and(...clauses)

  const author = alias(users, 'search_author')
  const rows = await db.select({
    id: memos.id, memoNumber: memos.memoNumber, subject: memos.subject,
    authorName: author.name, departmentName: departments.name, categoryName: memoCategories.name,
    status: memos.status, priority: memos.priority, createdAt: memos.createdAt,
  }).from(memos)
    .innerJoin(author, eq(author.id, memos.authorId))
    .leftJoin(departments, eq(departments.id, memos.departmentId))
    .leftJoin(memoCategories, eq(memoCategories.id, memos.categoryId))
    .where(where)
    .orderBy(desc(memos.createdAt))
    .limit(pageSize).offset(offset)

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(memos).where(where)

  return { rows, total: count }
}
