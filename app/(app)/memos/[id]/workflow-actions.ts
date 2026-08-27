'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/tenant'
import { actOnMemo, submitMemo, resubmitMemo, cancelMemo } from '@/lib/workflow'
import type { ActionState } from '@/app/(auth)/actions'

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

const actionSchema = z.object({
  memoId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'request_changes', 'comment', 'complete_review']),
  comment: z.string().max(5000).optional(),
})

export async function workflowAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = actionSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'That action is not valid.' }
  const { memoId, action, comment } = parsed.data

  const result = await actOnMemo(ctx, memoId, action, comment ?? null)
  if (!result.ok) return { error: result.error }
  refresh(memoId)
  return { ok: true }
}

const resubmitSchema = z.object({
  memoId: z.string().uuid(),
  mode: z.enum(['resume', 'restart']),
})

export async function resubmitAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = resubmitSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  const result = await resubmitMemo(ctx, parsed.data.memoId, parsed.data.mode)
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
