'use server'

import { z } from 'zod'
import path from 'node:path'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memos, memoAttachments, memoEvents, workflowSteps, departments, memoCategories, users } from '@/db/schema'
import { requireSession } from '@/lib/tenant'
import { getOrganization } from '@/lib/repo/org'
import { getOwnedMemo, countAttachments } from '@/lib/repo/memo'
import { sanitizeMemoHtml } from '@/lib/sanitize'
import { nextMemoNumber } from '@/lib/memo-number'
import { audit } from '@/lib/audit'
import { submitMemo } from '@/lib/workflow'
import type { ActionState } from '@/app/(auth)/actions'
import type { Priority, RequiredAction } from '@/db/schema'
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_PER_MEMO, ALLOWED_MIME } from '@/lib/attachment-limits'

const draftSchema = z.object({
  subject: z.string().min(3).max(200),
  bodyHtml: z.string().max(200_000),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  priority: z.enum(['normal', 'high', 'urgent']),
})

const stepInput = z.object({
  assigneeUserId: z.string().uuid(),
  positionTitle: z.string().min(1).max(120),
  requiredAction: z.enum(['approve', 'review']),
})

async function assertBelongsToOrg(orgId: string, departmentId?: string, categoryId?: string) {
  if (departmentId) {
    const [d] = await db.select({ id: departments.id }).from(departments)
      .where(and(eq(departments.id, departmentId), eq(departments.orgId, orgId)))
    if (!d) throw new Error('That department does not belong to your organization.')
  }
  if (categoryId) {
    const [c] = await db.select({ id: memoCategories.id }).from(memoCategories)
      .where(and(eq(memoCategories.id, categoryId), eq(memoCategories.orgId, orgId)))
    if (!c) throw new Error('That category does not belong to your organization.')
  }
}

/**
 * The whole memo — fields, workflow participants and attachments — arrives in
 * one submission from the New memo modal. `publish` decides whether it stops at
 * draft or goes straight into the workflow.
 */
const createSchema = draftSchema.extend({
  publish: z.enum(['true', 'false']).optional().default('false'),
  steps: z.string().optional().default('[]').transform((raw, ctx) => {
    try {
      return z.array(stepInput).parse(JSON.parse(raw))
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Give every workflow participant a position and an assignee.' })
      return z.NEVER
    }
  }),
})

/** Mirrors the per-file rules of `uploadAttachmentAction` for a whole batch. */
function rejectBadFiles(files: File[]): string | null {
  if (files.length > ATTACHMENT_MAX_PER_MEMO) {
    return `A memo can have at most ${ATTACHMENT_MAX_PER_MEMO} attachments.`
  }
  for (const file of files) {
    if (file.size > ATTACHMENT_MAX_BYTES) return `"${file.name}" is larger than 4 MB.`
    const allowedExts = ALLOWED_MIME[file.type]
    if (!allowedExts || !allowedExts.includes(path.extname(file.name).toLowerCase())) {
      return `"${file.name}" is not a supported file type.`
    }
  }
  return null
}

export async function createMemoAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const v = parsed.data
  const publish = v.publish === 'true'

  if (publish && v.steps.length === 0) {
    return { error: 'Add at least one workflow participant before publishing.' }
  }

  const files = formData.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  const fileError = rejectBadFiles(files)
  if (fileError) return { error: fileError }

  let memoId: string
  try {
    await assertBelongsToOrg(ctx.orgId, v.departmentId || undefined, v.categoryId || undefined)

    if (v.steps.length > 0) {
      const activeUsers = await db.select({ id: users.id }).from(users)
        .where(and(eq(users.orgId, ctx.orgId), eq(users.status, 'active')))
      const activeIds = new Set(activeUsers.map((u) => u.id))
      if (!v.steps.every((s) => activeIds.has(s.assigneeUserId))) {
        return { error: 'Every workflow participant must be an active user in your organization.' }
      }
    }

    const payloads = await Promise.all(files.map(async (file) => ({
      filename: sanitizeFilename(file.name),
      mime: file.type,
      sizeBytes: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    })))

    memoId = await db.transaction(async (tx) => {
      const org = await getOrganization(ctx)
      const memoNumber = await nextMemoNumber(tx, ctx.orgId, org?.config.memoPrefix ?? 'MEMO')

      const [memo] = await tx.insert(memos).values({
        orgId: ctx.orgId, memoNumber, subject: v.subject.trim(),
        bodyHtml: sanitizeMemoHtml(v.bodyHtml), authorId: ctx.user.id,
        departmentId: v.departmentId || null, categoryId: v.categoryId || null,
        priority: v.priority, status: 'draft',
      }).returning()

      await tx.insert(memoEvents).values({
        orgId: ctx.orgId, memoId: memo.id, type: 'created', actorId: ctx.user.id,
        detail: `Draft created`,
      })

      if (v.steps.length > 0) {
        await tx.insert(workflowSteps).values(v.steps.map((s, i) => ({
          orgId: ctx.orgId, memoId: memo.id, cycle: 1, stepNo: i + 1,
          positionTitle: s.positionTitle, assigneeUserId: s.assigneeUserId,
          requiredAction: s.requiredAction as RequiredAction,
        })))
      }

      for (const a of payloads) {
        await tx.insert(memoAttachments).values({
          orgId: ctx.orgId, memoId: memo.id, filename: a.filename, mime: a.mime,
          sizeBytes: a.sizeBytes, data: a.data, uploadedById: ctx.user.id, versionNo: 1,
        })
        await tx.insert(memoEvents).values({
          orgId: ctx.orgId, memoId: memo.id, type: 'attachment_added', actorId: ctx.user.id,
          detail: a.filename,
        })
      }

      await audit(tx, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_created',
        entityType: 'memo', entityId: memo.id, description: `${memo.memoNumber} created as draft`,
      })
      return memo.id
    })
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not create the memo.' }
  }

  if (publish) {
    const result = await submitMemo(ctx, memoId)
    // The memo exists as a draft either way; the author can publish it from there.
    if (!result.ok) return { error: result.error }
  }

  redirect(`/memos/${memoId}`)
}

const updateSchema = z.object({
  id: z.string().uuid(),
  subject: z.string().min(3).max(200),
  bodyHtml: z.string().max(200_000),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  categoryId: z.string().uuid().optional().or(z.literal('')),
  priority: z.enum(['normal', 'high', 'urgent']),
})

export async function updateDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const v = parsed.data

  const memo = await getOwnedMemo(ctx, v.id)
  if (!memo) return { error: 'Memo not found.' }
  if (memo.status !== 'draft' && memo.status !== 'changes_requested') {
    return { error: 'This memo can no longer be edited.' }
  }

  try {
    await assertBelongsToOrg(ctx.orgId, v.departmentId || undefined, v.categoryId || undefined)
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Invalid request.' }
  }

  await db.update(memos).set({
    subject: v.subject.trim(), bodyHtml: sanitizeMemoHtml(v.bodyHtml),
    departmentId: v.departmentId || null, categoryId: v.categoryId || null,
    priority: v.priority as Priority,
  }).where(eq(memos.id, v.id))

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_updated',
    entityType: 'memo', entityId: v.id, description: `${memo.memoNumber} edited`,
  })
  revalidatePath(`/memos/${v.id}/edit`)
  return { ok: true }
}

const idSchema = z.object({ id: z.string().uuid() })

export async function deleteDraftAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = idSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  const memo = await getOwnedMemo(ctx, parsed.data.id)
  if (!memo) return { error: 'Memo not found.' }
  if (memo.status !== 'draft') return { error: 'Only a draft can be deleted.' }

  await db.delete(memos).where(eq(memos.id, memo.id))
  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'memo_deleted',
    entityType: 'memo', entityId: memo.id, description: `Draft ${memo.memoNumber} deleted`,
  })
  redirect('/memos')
}

const setParticipantsSchema = z.object({
  id: z.string().uuid(),
  steps: z.string().transform((s, ctx) => {
    try {
      return z.array(stepInput).min(1, 'Add at least one workflow participant.').parse(JSON.parse(s))
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Invalid workflow steps.' })
      return z.NEVER
    }
  }),
})

export async function setParticipantsAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = setParticipantsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the workflow and try again.' }
  const { id: memoId, steps } = parsed.data

  const memo = await getOwnedMemo(ctx, memoId)
  if (!memo) return { error: 'Memo not found.' }
  if (memo.status !== 'draft' && memo.status !== 'changes_requested') {
    return { error: 'This memo can no longer be edited.' }
  }

  const assigneeIds = [...new Set(steps.map((s) => s.assigneeUserId))]
  const activeUsers = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.orgId, ctx.orgId), eq(users.status, 'active')))
  const activeIds = new Set(activeUsers.map((u) => u.id))
  if (!assigneeIds.every((id) => activeIds.has(id))) {
    return { error: 'Every workflow participant must be an active user in your organization.' }
  }

  await db.transaction(async (tx) => {
    await tx.delete(workflowSteps).where(and(eq(workflowSteps.memoId, memoId), eq(workflowSteps.cycle, 1)))
    await tx.insert(workflowSteps).values(steps.map((s, i) => ({
      orgId: ctx.orgId, memoId, cycle: 1, stepNo: i + 1,
      positionTitle: s.positionTitle, assigneeUserId: s.assigneeUserId,
      requiredAction: s.requiredAction as RequiredAction,
    })))
  })

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'participant_assigned',
    entityType: 'memo', entityId: memoId, description: `Workflow participants set (${steps.length} steps)`,
  })
  revalidatePath(`/memos/${memoId}/edit`)
  return { ok: true }
}

function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^\w.\- ]+/g, '_').slice(0, 200) || 'attachment'
}

export async function uploadAttachmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const memoId = formData.get('memoId')
  if (typeof memoId !== 'string') return { error: 'Invalid request.' }

  const memo = await getOwnedMemo(ctx, memoId)
  if (!memo) return { error: 'Memo not found.' }
  if (memo.status !== 'draft' && memo.status !== 'changes_requested') {
    return { error: 'Attachments can only be added while the memo is editable.' }
  }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose a file to upload.' }
  if (file.size > ATTACHMENT_MAX_BYTES) return { error: 'Files must be 4 MB or smaller.' }

  const ext = path.extname(file.name).toLowerCase()
  const allowedExts = ALLOWED_MIME[file.type]
  if (!allowedExts || !allowedExts.includes(ext)) {
    return { error: 'That file type is not supported.' }
  }

  const existing = await countAttachments(ctx, memoId)
  if (existing >= ATTACHMENT_MAX_PER_MEMO) {
    return { error: `A memo can have at most ${ATTACHMENT_MAX_PER_MEMO} attachments.` }
  }

  const bytes = Buffer.from(await file.arrayBuffer())
  const filename = sanitizeFilename(file.name)

  await db.transaction(async (tx) => {
    await tx.insert(memoAttachments).values({
      orgId: ctx.orgId, memoId, filename, mime: file.type, sizeBytes: file.size,
      data: bytes, uploadedById: ctx.user.id, versionNo: memo.currentVersion || 1,
    })
    await tx.insert(memoEvents).values({
      orgId: ctx.orgId, memoId, type: 'attachment_added', actorId: ctx.user.id,
      detail: filename,
    })
  })

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'attachment_upload',
    entityType: 'memo', entityId: memoId, description: `Attachment "${filename}" uploaded to ${memo.memoNumber}`,
  })
  revalidatePath(`/memos/${memoId}/edit`)
  return { ok: true }
}

const deleteAttachmentSchema = z.object({ memoId: z.string().uuid(), attachmentId: z.string().uuid() })

export async function deleteAttachmentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = deleteAttachmentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  const memo = await getOwnedMemo(ctx, parsed.data.memoId)
  if (!memo) return { error: 'Memo not found.' }
  if (memo.status !== 'draft' && memo.status !== 'changes_requested') {
    return { error: 'Attachments can only be removed while the memo is editable.' }
  }

  const [deleted] = await db.delete(memoAttachments)
    .where(and(
      eq(memoAttachments.id, parsed.data.attachmentId),
      eq(memoAttachments.memoId, parsed.data.memoId),
      eq(memoAttachments.orgId, ctx.orgId),
    ))
    .returning({ filename: memoAttachments.filename })
  if (!deleted) return { error: 'Attachment not found.' }

  await db.insert(memoEvents).values({
    orgId: ctx.orgId, memoId: parsed.data.memoId, type: 'attachment_deleted', actorId: ctx.user.id,
    detail: deleted.filename,
  })
  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'attachment_delete',
    entityType: 'memo', entityId: parsed.data.memoId, description: `Attachment "${deleted.filename}" removed`,
  })
  revalidatePath(`/memos/${parsed.data.memoId}/edit`)
  return { ok: true }
}
