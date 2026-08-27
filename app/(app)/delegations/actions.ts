'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { delegations, users } from '@/db/schema'
import { requireSession } from '@/lib/tenant'
import { audit } from '@/lib/audit'
import { notify } from '@/lib/notify'
import type { ActionState } from '@/app/(auth)/actions'

const createSchema = z.object({
  delegateId: z.string().uuid(),
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().max(500).optional().or(z.literal('')),
})

export async function createDelegation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Check the form and try again.' }
  const v = parsed.data

  if (v.delegateId === ctx.user.id) return { error: 'You cannot delegate to yourself.' }

  const startAt = new Date(`${v.startDate}T00:00:00`)
  const endAt = new Date(`${v.endDate}T23:59:59`)
  if (!(endAt > startAt)) return { error: 'The end date must be after the start date.' }

  const [delegate] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, v.delegateId), eq(users.orgId, ctx.orgId), eq(users.status, 'active')))
  if (!delegate) return { error: 'Choose an active user from your organization.' }

  const [row] = await db.insert(delegations).values({
    orgId: ctx.orgId, delegatorId: ctx.user.id, delegateId: v.delegateId,
    startAt, endAt, reason: v.reason || null, status: 'active',
  }).returning()

  await notify(undefined, {
    orgId: ctx.orgId, userId: v.delegateId, type: 'workflow_assigned',
    title: `${ctx.user.name} delegated workflow authority to you`,
    body: v.reason || undefined,
  })
  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'delegation_created',
    entityType: 'delegation', entityId: row.id,
    description: `${ctx.user.name} delegated to ${delegate.id}`,
  })
  revalidatePath('/delegations')
  return { ok: true }
}

const revokeSchema = z.object({ id: z.string().uuid() })

export async function revokeDelegation(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = revokeSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  const result = await db.update(delegations).set({ status: 'revoked' })
    .where(and(
      eq(delegations.id, parsed.data.id),
      eq(delegations.orgId, ctx.orgId),
      eq(delegations.delegatorId, ctx.user.id),
    ))
    .returning({ id: delegations.id })
  if (result.length === 0) return { error: 'Delegation not found.' }

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'delegation_revoked',
    entityType: 'delegation', entityId: parsed.data.id, description: 'Delegation revoked',
  })
  revalidatePath('/delegations')
  return { ok: true }
}
