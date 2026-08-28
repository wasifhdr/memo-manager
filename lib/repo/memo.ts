import { and, asc, desc, eq, exists, inArray, or, sql, type SQL } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import {
  memos, memoAttachments, workflowSteps, memoEvents, memoVersions,
  departments, memoCategories, users,
  type MemoStatus, type Priority,
} from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'
import { getMemoAccess, activeDelegatorIds } from '@/lib/authz'

export type MemoListFilters = {
  status?: MemoStatus
  priority?: Priority
  categoryId?: string
  departmentId?: string
  page?: number
  pageSize?: number
}

const DEFAULT_PAGE_SIZE = 25

function paginate(f: MemoListFilters) {
  const pageSize = f.pageSize && f.pageSize > 0 ? Math.min(f.pageSize, 100) : DEFAULT_PAGE_SIZE
  const page = f.page && f.page > 0 ? f.page : 1
  return { pageSize, offset: (page - 1) * pageSize }
}

function commonFilters(f: MemoListFilters): SQL[] {
  const clauses: SQL[] = []
  if (f.status) clauses.push(eq(memos.status, f.status))
  if (f.priority) clauses.push(eq(memos.priority, f.priority))
  if (f.categoryId) clauses.push(eq(memos.categoryId, f.categoryId))
  if (f.departmentId) clauses.push(eq(memos.departmentId, f.departmentId))
  return clauses
}

/**
 * A memo the caller authored, scoped to their org. Used by the draft
 * create/edit/delete actions — a memo belonging to another org, or another
 * author, is indistinguishable from a missing one.
 */
export async function getOwnedMemo(ctx: TenantContext, memoId: string) {
  const [memo] = await db.select().from(memos)
    .where(and(eq(memos.id, memoId), eq(memos.orgId, ctx.orgId), eq(memos.authorId, ctx.user.id)))
    .limit(1)
  return memo ?? null
}

export async function listAttachments(ctx: TenantContext, memoId: string) {
  return db.select({
    id: memoAttachments.id, filename: memoAttachments.filename, mime: memoAttachments.mime,
    sizeBytes: memoAttachments.sizeBytes, uploadedById: memoAttachments.uploadedById,
    versionNo: memoAttachments.versionNo, createdAt: memoAttachments.createdAt,
  }).from(memoAttachments)
    .where(and(eq(memoAttachments.memoId, memoId), eq(memoAttachments.orgId, ctx.orgId)))
    .orderBy(asc(memoAttachments.createdAt))
}

export async function countAttachments(ctx: TenantContext, memoId: string): Promise<number> {
  const rows = await listAttachments(ctx, memoId)
  return rows.length
}

export async function listAttachmentsWithUploader(ctx: TenantContext, memoId: string) {
  return db.select({
    id: memoAttachments.id, filename: memoAttachments.filename, mime: memoAttachments.mime,
    sizeBytes: memoAttachments.sizeBytes, createdAt: memoAttachments.createdAt,
    uploadedByName: users.name,
  }).from(memoAttachments)
    .innerJoin(users, eq(users.id, memoAttachments.uploadedById))
    .where(and(eq(memoAttachments.memoId, memoId), eq(memoAttachments.orgId, ctx.orgId)))
    .orderBy(asc(memoAttachments.createdAt))
}

export async function getDraftParticipants(ctx: TenantContext, memoId: string) {
  return db.select().from(workflowSteps)
    .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.orgId, ctx.orgId), eq(workflowSteps.cycle, 1)))
    .orderBy(asc(workflowSteps.stepNo))
}

export type MemoDetail = Awaited<ReturnType<typeof getMemoDetail>>

/**
 * The full memo detail view — memo, author/department/category, every
 * cycle's workflow steps, the append-only event timeline, attachments and
 * version metadata. Returns null when the caller cannot view this memo at
 * all, so no page ever renders content the viewer is not authorized to see.
 */
export async function getMemoDetail(ctx: TenantContext, memoId: string) {
  const access = await getMemoAccess(ctx, memoId)
  if (!access?.canView) return null

  const author = alias(users, 'author')
  const [memo] = await db.select({
    id: memos.id, memoNumber: memos.memoNumber, subject: memos.subject, bodyHtml: memos.bodyHtml,
    authorId: memos.authorId, authorName: author.name,
    departmentName: departments.name, categoryName: memoCategories.name,
    priority: memos.priority, status: memos.status,
    currentCycle: memos.currentCycle, currentStepNo: memos.currentStepNo, currentVersion: memos.currentVersion,
    submittedAt: memos.submittedAt, completedAt: memos.completedAt, cancelledAt: memos.cancelledAt,
    finalApproverId: memos.finalApproverId, createdAt: memos.createdAt,
  }).from(memos)
    .innerJoin(author, eq(author.id, memos.authorId))
    .leftJoin(departments, eq(departments.id, memos.departmentId))
    .leftJoin(memoCategories, eq(memoCategories.id, memos.categoryId))
    .where(and(eq(memos.id, memoId), eq(memos.orgId, ctx.orgId)))
    .limit(1)
  if (!memo) return null

  const assignee = alias(users, 'assignee')
  const actedBy = alias(users, 'acted_by')
  const onBehalfOf = alias(users, 'on_behalf_of')
  const steps = await db.select({
    id: workflowSteps.id, cycle: workflowSteps.cycle, stepNo: workflowSteps.stepNo,
    positionTitle: workflowSteps.positionTitle,
    assigneeId: workflowSteps.assigneeUserId, assigneeName: assignee.name,
    requiredAction: workflowSteps.requiredAction, outcome: workflowSteps.outcome,
    actedByName: actedBy.name, onBehalfOfName: onBehalfOf.name,
    actedAt: workflowSteps.actedAt, comment: workflowSteps.comment,
  }).from(workflowSteps)
    .innerJoin(assignee, eq(assignee.id, workflowSteps.assigneeUserId))
    .leftJoin(actedBy, eq(actedBy.id, workflowSteps.actedByUserId))
    .leftJoin(onBehalfOf, eq(onBehalfOf.id, workflowSteps.onBehalfOfUserId))
    .where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.orgId, ctx.orgId)))
    .orderBy(asc(workflowSteps.cycle), asc(workflowSteps.stepNo))

  const actor = alias(users, 'actor')
  const eventOnBehalfOf = alias(users, 'event_on_behalf_of')
  const allEvents = await db.select({
    id: memoEvents.id, type: memoEvents.type, actorId: memoEvents.actorId,
    actorName: actor.name, onBehalfOfName: eventOnBehalfOf.name,
    cycle: memoEvents.cycle, stepNo: memoEvents.stepNo,
    comment: memoEvents.comment, detail: memoEvents.detail, createdAt: memoEvents.createdAt,
  }).from(memoEvents)
    .leftJoin(actor, eq(actor.id, memoEvents.actorId))
    .leftJoin(eventOnBehalfOf, eq(eventOnBehalfOf.id, memoEvents.onBehalfOfId))
    .where(and(eq(memoEvents.memoId, memoId), eq(memoEvents.orgId, ctx.orgId)))
    .orderBy(asc(memoEvents.createdAt))

  const editor = alias(users, 'editor')
  const versions = await db.select({
    versionNo: memoVersions.versionNo, editorName: editor.name,
    createdAt: memoVersions.createdAt, submittedAt: memoVersions.submittedAt,
  }).from(memoVersions)
    .innerJoin(editor, eq(editor.id, memoVersions.editorId))
    .where(and(eq(memoVersions.memoId, memoId), eq(memoVersions.orgId, ctx.orgId)))
    .orderBy(asc(memoVersions.versionNo))

  // Thread comments are a conversation, not workflow history: they render in
  // the chat thread and are kept out of the activity timeline.
  const events = allEvents.filter((e) => e.type !== 'comment')
  const thread = allEvents.filter((e) => e.type === 'comment')

  const attachments = await listAttachmentsWithUploader(ctx, memoId)

  // Group steps by cycle for the workflow rail; the highest cycle is current.
  const cycles = Array.from(new Set(steps.map((s) => s.cycle))).sort((a, b) => a - b)
    .map((cycle) => ({ cycle, steps: steps.filter((s) => s.cycle === cycle) }))

  return { memo, cycles, events, thread, versions, attachments, access }
}

/**
 * Memos requiring the caller's action right now — the current step of the
 * current cycle, still pending, assigned to them or an active delegator of
 * theirs. §6.1.
 */
export async function listInbox(ctx: TenantContext, f: MemoListFilters) {
  const delegators = await activeDelegatorIds(ctx, ctx.user.id)
  const actsFor = [ctx.user.id, ...delegators]
  const { pageSize, offset } = paginate(f)

  const author = alias(users, 'inbox_author')
  const where = and(
    eq(memos.orgId, ctx.orgId),
    eq(workflowSteps.memoId, memos.id),
    eq(workflowSteps.cycle, memos.currentCycle),
    eq(workflowSteps.stepNo, memos.currentStepNo),
    eq(workflowSteps.outcome, 'pending'),
    inArray(workflowSteps.assigneeUserId, actsFor),
    ...commonFilters(f),
  )

  const base = () => db.select().from(memos)
    .innerJoin(workflowSteps, eq(workflowSteps.memoId, memos.id))
    .innerJoin(author, eq(author.id, memos.authorId))
    .leftJoin(departments, eq(departments.id, memos.departmentId))
    .where(where)

  const rows = await base()
    .orderBy(desc(memos.priority), asc(memos.submittedAt))
    .limit(pageSize).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(memos)
    .innerJoin(workflowSteps, eq(workflowSteps.memoId, memos.id))
    .where(where)

  return {
    rows: rows.map((r) => ({
      id: r.memos.id, memoNumber: r.memos.memoNumber, subject: r.memos.subject,
      authorName: r.inbox_author.name, departmentName: r.departments?.name ?? null,
      priority: r.memos.priority, status: r.memos.status, submittedAt: r.memos.submittedAt,
      requiredAction: r.workflow_steps.requiredAction,
    })),
    total: count,
  }
}

/** Memos the caller authored. §6.2. */
export async function listMyMemos(ctx: TenantContext, f: MemoListFilters) {
  const { pageSize, offset } = paginate(f)
  const participant = alias(users, 'current_participant')

  const where = and(eq(memos.orgId, ctx.orgId), eq(memos.authorId, ctx.user.id), ...commonFilters(f))

  const rows = await db.select().from(memos)
    .leftJoin(workflowSteps, and(
      eq(workflowSteps.memoId, memos.id),
      eq(workflowSteps.cycle, memos.currentCycle),
      eq(workflowSteps.stepNo, memos.currentStepNo),
    ))
    .leftJoin(participant, eq(participant.id, workflowSteps.assigneeUserId))
    .where(where)
    .orderBy(desc(memos.lastActivityAt))
    .limit(pageSize).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(memos).where(where)

  return {
    rows: rows.map((r) => ({
      id: r.memos.id, memoNumber: r.memos.memoNumber, subject: r.memos.subject,
      status: r.memos.status, priority: r.memos.priority,
      currentParticipantName: r.current_participant?.name ?? null,
      submittedAt: r.memos.submittedAt, lastActivityAt: r.memos.lastActivityAt,
    })),
    total: count,
  }
}

/** Completed workflows (approved/rejected/cancelled) the caller may see. §6.3. */
export async function listCompleted(ctx: TenantContext, f: MemoListFilters) {
  const { pageSize, offset } = paginate(f)
  const delegators = await activeDelegatorIds(ctx, ctx.user.id)
  const actsFor = [ctx.user.id, ...delegators]
  const author = alias(users, 'completed_author')

  const visibility = ctx.user.role === 'org_admin'
    ? undefined
    : or(
        eq(memos.authorId, ctx.user.id),
        exists(db.select({ one: sql`1` }).from(workflowSteps)
          .where(and(eq(workflowSteps.memoId, memos.id), inArray(workflowSteps.assigneeUserId, actsFor)))),
      )

  const where = and(
    eq(memos.orgId, ctx.orgId),
    inArray(memos.status, ['approved', 'rejected', 'cancelled']),
    visibility,
    ...commonFilters(f),
  )

  const rows = await db.select().from(memos)
    .innerJoin(author, eq(author.id, memos.authorId))
    .leftJoin(departments, eq(departments.id, memos.departmentId))
    .where(where)
    .orderBy(desc(memos.completedAt), desc(memos.cancelledAt))
    .limit(pageSize).offset(offset)
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(memos).where(where)

  return {
    rows: rows.map((r) => ({
      id: r.memos.id, memoNumber: r.memos.memoNumber, subject: r.memos.subject,
      authorName: r.completed_author.name, departmentName: r.departments?.name ?? null,
      status: r.memos.status, priority: r.memos.priority,
      completedAt: r.memos.completedAt ?? r.memos.cancelledAt,
    })),
    total: count,
  }
}

/** Version metadata (no body) for anyone who can view the memo. §17. */
export async function listVersions(ctx: TenantContext, memoId: string) {
  const access = await getMemoAccess(ctx, memoId)
  if (!access?.canView) return null

  const editor = alias(users, 'version_editor')
  return db.select({
    versionNo: memoVersions.versionNo, editorName: editor.name,
    createdAt: memoVersions.createdAt, submittedAt: memoVersions.submittedAt,
  }).from(memoVersions)
    .innerJoin(editor, eq(editor.id, memoVersions.editorId))
    .where(and(eq(memoVersions.memoId, memoId), eq(memoVersions.orgId, ctx.orgId)))
    .orderBy(asc(memoVersions.versionNo))
}

/** One version's full content — nothing in the app ever updates this row. §17. */
export async function getVersion(ctx: TenantContext, memoId: string, versionNo: number) {
  const access = await getMemoAccess(ctx, memoId)
  if (!access?.canView) return null

  const editor = alias(users, 'single_version_editor')
  const [version] = await db.select({
    versionNo: memoVersions.versionNo, subject: memoVersions.subject, bodyHtml: memoVersions.bodyHtml,
    editorName: editor.name, createdAt: memoVersions.createdAt, submittedAt: memoVersions.submittedAt,
  }).from(memoVersions)
    .innerJoin(editor, eq(editor.id, memoVersions.editorId))
    .where(and(
      eq(memoVersions.memoId, memoId), eq(memoVersions.orgId, ctx.orgId),
      eq(memoVersions.versionNo, versionNo),
    ))
    .limit(1)
  return version ?? null
}
