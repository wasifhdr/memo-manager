'use server'

import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/db/schema'
import { requireSession, setSessionCookie } from '@/lib/tenant'
import { hashPassword, verifyPassword, revokeUserSessions, createSession } from '@/lib/auth'
import { audit } from '@/lib/audit'
import type { ActionState } from '@/app/(auth)/actions'

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Enter the password you signed in with.'),
    newPassword: z.string().min(10, 'Use at least 10 characters.').max(200),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, {
    message: 'The two new passwords do not match.',
    path: ['confirm'],
  })

/**
 * The forced first-login password change. Distinct from the profile version in
 * two ways: it runs with the password gate lifted (otherwise requireSession
 * would bounce it back to itself), and it redirects into the app on success.
 */
export async function completePasswordChange(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession({ allowPendingPasswordChange: true })
  const parsed = schema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1)
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return { error: 'That is not the password you signed in with.' }
  }
  if (await verifyPassword(parsed.data.newPassword, user.passwordHash)) {
    return { error: 'Choose a password different from the one you were given.' }
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  await db.update(users)
    .set({ passwordHash, mustChangePassword: false })
    .where(eq(users.id, ctx.user.id))

  // Drop every session (the issued password may have been shared with others,
  // and in a bulk batch it was), then re-issue one for this device.
  await revokeUserSessions(ctx.user.id)
  const raw = await createSession(ctx.user.id)
  await setSessionCookie(raw)

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'password_change',
    entityType: 'user', entityId: ctx.user.id,
    description: 'Initial password changed on first sign-in',
  })

  redirect('/dashboard')
}
