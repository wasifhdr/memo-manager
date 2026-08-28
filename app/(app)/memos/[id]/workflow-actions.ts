'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/tenant'
import {
  actOnMemo, submitMemo, resubmitMemo, cancelMemo,
  reassignStep, addParticipant, removeParticipant,
} from '@/lib/workflow'
import type { ActionState } from '@/app/(auth)/actions'
import { isMissingReason, REASON_REQUIRED_MESSAGE } from '@/lib/decision-rules'

function refresh(memoId: string) {
  revalidatePath(`/memos/${memoId}`)
  revalidatePath('/inbox')
  revalidatePath('/memos')
  revalidatePath('/completed')
  revalidatePath('/dashboard')
}

const submitSchema = z.object({ memoId: z.string().uuid() })

export async function submitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = submitSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  const result = await submitMemo(ctx, parsed.data.memoId)
  if (!result.ok) return { error: result.error }
  refresh(parsed.data.memoId)
  return { ok: true }
}

const actionSchema = z
  .object({
    memoId: z.string().uuid(),
    action: z.enum(['approve', 'reject', 'request_changes', 'comment', 'complete_review']),
    comment: z.string().max(5000).optional(),
    // Approve and hand the memo to someone outside the workflow on the way past.
    forwardToUserId: z.string().uuid().optional().or(z.literal('')),
    forwardPosition: z.string().max(120).optional(),
  })
  // Enforced here, not only by the disabled button, so the rule holds however
  // the action is called.
  .refine((v) => !isMissingReason(v.action, v.comment), {
    message: REASON_REQUIRED_MESSAGE,
    path: ['comment'],
  })

export async function workflowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = actionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'That action is not valid.' }
  }
  const { memoId, action, comment, forwardToUserId, forwardPosition } = parsed.data

  const result = await actOnMemo(ctx, memoId, action, comment ?? null,
    forwardToUserId ? { userId: forwardToUserId, positionTitle: forwardPosition ?? null } : null)
  if (!result.ok) return { error: result.error }
  refresh(memoId)
  return { ok: true }
}

const resubmitSchema = z.object({ memoId: z.string().uuid() })

export async function resubmitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = resubmitSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  const result = await resubmitMemo(ctx, parsed.data.memoId)
  if (!result.ok) return { error: result.error }
  refresh(parsed.data.memoId)
  return { ok: true }
}

const cancelSchema = z.object({ memoId: z.string().uuid(), reason: z.string().max(2000).optional() })

export async function cancelAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = cancelSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  const result = await cancelMemo(ctx, parsed.data.memoId, parsed.data.reason ?? null)
  if (!result.ok) return { error: result.error }
  refresh(parsed.data.memoId)
  return { ok: true }
}

const reassignSchema = z.object({
  memoId: z.string().uuid(),
  stepId: z.string().uuid(),
  toUserId: z.string().uuid(),
  positionTitle: z.string().max(120).optional(),
  comment: z.string().max(5000).optional(),
})

export async function reassignAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = reassignSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Choose who should take this step.' }
  const v = parsed.data

  const result = await reassignStep(ctx, v.memoId, v.stepId, v.toUserId, v.positionTitle ?? null, v.comment ?? null)
  if (!result.ok) return { error: result.error }
  refresh(v.memoId)
  return { ok: true }
}

const addParticipantSchema = z.object({
  memoId: z.string().uuid(),
  afterStepNo: z.coerce.number().int().min(1),
  userId: z.string().uuid(),
  positionTitle: z.string().max(120).optional(),
})

export async function addParticipantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = addParticipantSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Choose who to add to the workflow.' }
  const v = parsed.data

  const result = await addParticipant(ctx, v.memoId, {
    afterStepNo: v.afterStepNo, userId: v.userId, positionTitle: v.positionTitle ?? null,
  })
  if (!result.ok) return { error: result.error }
  refresh(v.memoId)
  return { ok: true }
}

const removeParticipantSchema = z.object({ memoId: z.string().uuid(), stepId: z.string().uuid() })

export async function removeParticipantAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = removeParticipantSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }
  const v = parsed.data

  const result = await removeParticipant(ctx, v.memoId, v.stepId)
  if (!result.ok) return { error: result.error }
  refresh(v.memoId)
  return { ok: true }
}
