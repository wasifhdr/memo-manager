import { and, count, desc, eq, exists, gte, inArray, or, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import { memos, workflowSteps, users, departments, auditLog, type MemoStatus } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'
import { activeDelegatorIds } from '@/lib/authz'
import { listInbox, listMyMemos, listCompleted } from '@/lib/repo/memo'

const ALL_STATUSES: MemoStatus[] = [
  'draft', 'submitted', 'pending_review', 'pending_approval',
  'changes_requested', 'rejected', 'approved', 'cancelled',
]

/** The dashboard's "recent activity" is bounded to the last 30 days. */
function recentWindow(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
}

export async function userDashboard(ctx: TenantContext) {
  // Only this first query has to happen on its own — everything below needs
  // the delegator list. The rest are independent of each other, so they go in
  // one batch: against a database in another region, each extra sequential
  // await costs a full round trip.
  const delegators = await activeDelegatorIds(ctx, ctx.user.id)
  const actsFor = [ctx.user.id, ...delegators]

  const actor = alias(users, 'actor')

  const [
    awaitingMyAction, submittedByMe, recentlyCompleted,
    inboxByAction, urgentRows, statusRows, recentActivity,
  ] = await Promise.all([
    listInbox(ctx, { pageSize: 5 }),
    listMyMemos(ctx, { pageSize: 5 }),
    listCompleted(ctx, { pageSize: 5 }),

    db.select({ requiredAction: workflowSteps.requiredAction, n: count() }).from(memos)
      .innerJoin(workflowSteps, and(
        eq(workflowSteps.memoId, memos.id),
        eq(workflowSteps.cycle, memos.currentCycle),
        eq(workflowSteps.stepNo, memos.currentStepNo),
        eq(workflowSteps.outcome, 'pending'),
      ))
      .where(and(eq(memos.orgId, ctx.orgId), inArray(workflowSteps.assigneeUserId, actsFor)))
      .groupBy(workflowSteps.requiredAction),

    db.select({ n: count() }).from(memos)
      .where(and(
        eq(memos.orgId, ctx.orgId),
        eq(memos.priority, 'urgent'),
        inArray(memos.status, ['submitted', 'pending_review', 'pending_approval', 'changes_requested']),
        or(
          eq(memos.authorId, ctx.user.id),
          exists(db.select({ one: sql`1` }).from(workflowSteps)
            .where(and(eq(workflowSteps.memoId, memos.id), inArray(workflowSteps.assigneeUserId, actsFor)))),
        ),
      )),

    db.select({ status: memos.status, n: count() }).from(memos)
      .where(and(eq(memos.orgId, ctx.orgId), eq(memos.authorId, ctx.user.id)))
      .groupBy(memos.status),

    db.select({
      id: auditLog.id, eventType: auditLog.eventType, description: auditLog.description,
      createdAt: auditLog.createdAt, actorName: actor.name,
    }).from(auditLog)
      .leftJoin(actor, eq(actor.id, auditLog.actorId))
      .where(and(
        eq(auditLog.orgId, ctx.orgId), eq(auditLog.actorId, ctx.user.id),
        gte(auditLog.createdAt, recentWindow()),
      ))
      .orderBy(desc(auditLog.createdAt))
      .limit(10),
  ])

  const pendingApprovals = inboxByAction.find((r) => r.requiredAction === 'approve')?.n ?? 0
  const pendingReviews = inboxByAction.find((r) => r.requiredAction === 'review')?.n ?? 0
  const urgentMemos = urgentRows[0]?.n ?? 0

  const countsByStatus = Object.fromEntries(ALL_STATUSES.map((s) => [s, 0])) as Record<MemoStatus, number>
  for (const row of statusRows) countsByStatus[row.status] = row.n

  return {
    awaitingMyAction, submittedByMe, recentlyCompleted,
    pendingApprovals, pendingReviews, urgentMemos, countsByStatus, recentActivity,
  }
}

export async function adminDashboard(ctx: TenantContext) {
  const [
    [{ n: userCount }], [{ n: activeUserCount }], [{ n: departmentCount }], [{ n: memoCount }],
    [{ n: pendingWorkflows }], [{ n: completedWorkflows }], [{ n: rejectedWorkflows }],
  ] = await Promise.all([
    db.select({ n: count() }).from(users).where(eq(users.orgId, ctx.orgId)),
    db.select({ n: count() }).from(users).where(and(eq(users.orgId, ctx.orgId), eq(users.status, 'active'))),
    db.select({ n: count() }).from(departments).where(and(eq(departments.orgId, ctx.orgId), eq(departments.active, true))),
    db.select({ n: count() }).from(memos).where(eq(memos.orgId, ctx.orgId)),
    db.select({ n: count() }).from(memos).where(and(
      eq(memos.orgId, ctx.orgId),
      inArray(memos.status, ['submitted', 'pending_review', 'pending_approval', 'changes_requested']),
    )),
    db.select({ n: count() }).from(memos).where(and(eq(memos.orgId, ctx.orgId), eq(memos.status, 'approved'))),
    db.select({ n: count() }).from(memos).where(and(eq(memos.orgId, ctx.orgId), eq(memos.status, 'rejected'))),
  ])

  const actor = alias(users, 'actor')
  const recentActivity = await db.select({
    id: auditLog.id, eventType: auditLog.eventType, description: auditLog.description,
    createdAt: auditLog.createdAt, actorName: actor.name,
  }).from(auditLog)
    .leftJoin(actor, eq(actor.id, auditLog.actorId))
    .where(and(eq(auditLog.orgId, ctx.orgId), gte(auditLog.createdAt, recentWindow())))
    .orderBy(desc(auditLog.createdAt))
    .limit(10)

  return {
    userCount, activeUserCount, departmentCount, memoCount,
    pendingWorkflows, completedWorkflows, rejectedWorkflows, recentActivity,
  }
}
