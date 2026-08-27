import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memos, memoAttachments, workflowSteps, users } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

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
