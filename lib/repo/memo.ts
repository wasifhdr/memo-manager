import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { db } from '@/lib/db'
import {
  memos, memoAttachments, workflowSteps, memoEvents, memoVersions,
  departments, memoCategories, users,
} from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'
import { getMemoAccess } from '@/lib/authz'

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
  const events = await db.select({
    id: memoEvents.id, type: memoEvents.type,
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

  const attachments = await listAttachmentsWithUploader(ctx, memoId)

  // Group steps by cycle for the workflow rail; the highest cycle is current.
  const cycles = Array.from(new Set(steps.map((s) => s.cycle))).sort((a, b) => a - b)
    .map((cycle) => ({ cycle, steps: steps.filter((s) => s.cycle === cycle) }))

  return { memo, cycles, events, versions, attachments, access }
}
