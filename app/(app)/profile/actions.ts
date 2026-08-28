'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/db/schema'
import { requireSession } from '@/lib/tenant'
import { verifyPassword, hashPassword, revokeUserSessions, createSession } from '@/lib/auth'
import { setSessionCookie } from '@/lib/tenant'
import { audit } from '@/lib/audit'
import type { ActionState } from '@/app/(auth)/actions'

const profileSchema = z.object({
  name: z.string().min(2).max(120),
  designation: z.string().max(120).optional().or(z.literal('')),
})

export async function updateProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = profileSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Check the form and try again.' }

  await db.update(users)
    .set({ name: parsed.data.name.trim(), designation: parsed.data.designation || null })
    .where(eq(users.id, ctx.user.id))

  revalidatePath('/profile')
  return { ok: true }
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(10, 'Use at least 10 characters.'),
  confirm: z.string(),
}).refine((v) => v.newPassword === v.confirm, { message: 'Passwords do not match.', path: ['confirm'] })

export async function changePasswordAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1)
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { error: 'Your current password is incorrect.' }
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  // Choosing their own password clears the administrator-issued gate.
  await db.update(users).set({ passwordHash, mustChangePassword: false }).where(eq(users.id, ctx.user.id))

  // Revoke every session — including this one — then issue a fresh one so
  // the user stays signed in only on this device.
  await revokeUserSessions(ctx.user.id)
  const raw = await createSession(ctx.user.id)
  await setSessionCookie(raw)

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'password_change',
    entityType: 'user', entityId: ctx.user.id, description: 'Password changed by user',
  })

  revalidatePath('/profile')
  return { ok: true }
}
