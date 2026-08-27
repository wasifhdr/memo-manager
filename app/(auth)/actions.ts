'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users } from '@/db/schema'
import {
  verifyPassword, createSession, destroySession, hashPassword,
  createPasswordResetToken, consumePasswordResetToken, revokeUserSessions,
} from '@/lib/auth'
import { setSessionCookie, clearSessionCookie, SESSION_COOKIE } from '@/lib/tenant'
import { createOrganization } from '@/lib/org-setup'
import { audit } from '@/lib/audit'

export type ActionState = { error?: string; ok?: true } | undefined

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  next: z.string().optional(),
})

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Enter a valid email address and password.' }
  const { email, password, next } = parsed.data

  const [user] = await db.select().from(users)
    .where(eq(users.email, email.toLowerCase())).limit(1)

  // One generic message for unknown email, wrong password and inactive account:
  // the response must not reveal which accounts exist (§21.13).
  const bad: ActionState = { error: 'Those credentials are not valid.' }
  if (!user) { await hashPassword('timing-equaliser'); return bad }
  if (!(await verifyPassword(password, user.passwordHash))) return bad
  if (user.status !== 'active') return bad

  const ua = (await headers()).get('user-agent')
  const raw = await createSession(user.id, ua)
  await setSessionCookie(raw)
  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id))
  await audit(undefined, {
    orgId: user.orgId, actorId: user.id, eventType: 'user_login',
    entityType: 'user', entityId: user.id, description: `${user.email} logged in`,
  })
  redirect(next && next.startsWith('/') ? next : '/dashboard')
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (raw) await destroySession(raw)
  await clearSessionCookie()
  redirect('/login')
}

const registerSchema = z.object({
  orgName: z.string().min(2).max(120),
  orgCode: z.string().min(2).max(12).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and hyphens only.'),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(40).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
  adminName: z.string().min(2).max(120),
  adminEmail: z.string().email(),
  password: z.string().min(10, 'Use at least 10 characters.'),
})

export async function registerOrganizationAction(
  _prev: ActionState, formData: FormData,
): Promise<ActionState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  }
  const v = parsed.data

  const result = await createOrganization({
    orgName: v.orgName, orgCode: v.orgCode,
    adminName: v.adminName, adminEmail: v.adminEmail, password: v.password,
    contactEmail: v.contactEmail || null,
    contactPhone: v.contactPhone || null,
    address: v.address || null,
  })
  if (!result.ok) return { error: result.error }

  const ua = (await headers()).get('user-agent')
  const raw = await createSession(result.userId, ua)
  await setSessionCookie(raw)
  redirect('/dashboard')
}

const forgotSchema = z.object({ email: z.string().email() })

export async function requestPasswordResetAction(
  _prev: ActionState, formData: FormData,
): Promise<ActionState> {
  const parsed = forgotSchema.safeParse(Object.fromEntries(formData))
  // Same confirmation whether or not the address exists — never reveal which
  // accounts exist (§21.13).
  const confirmation: ActionState = { ok: true }
  if (!parsed.success) return confirmation

  const [user] = await db.select().from(users)
    .where(eq(users.email, parsed.data.email.toLowerCase())).limit(1)
  if (!user || user.status !== 'active') return confirmation

  const raw = await createPasswordResetToken(user.id)
  const h = await headers()
  const origin = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host') ?? 'localhost:3000'}`
  // No outbound email in this deployment (see PRODUCT.md) — the link is
  // surfaced here and an org admin can also generate one from the user list.
  console.info(`[password-reset] ${user.email} -> ${origin}/reset-password/${raw}`)
  return confirmation
}

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(10, 'Use at least 10 characters.'),
  confirm: z.string(),
}).refine((v) => v.password === v.confirm, { message: 'Passwords do not match.', path: ['confirm'] })

export async function resetPasswordAction(
  _prev: ActionState, formData: FormData,
): Promise<ActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }

  const userId = await consumePasswordResetToken(parsed.data.token)
  if (!userId) return { error: 'This reset link is invalid or has expired.' }

  const passwordHash = await hashPassword(parsed.data.password)
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
  await revokeUserSessions(userId)
  // Revoking sessions does not remove the browser's cookie — clear it too,
  // or middleware sees a (now-invalid) cookie and bounces /login to /dashboard.
  await clearSessionCookie()
  await audit(undefined, {
    orgId: null, actorId: userId, eventType: 'password_reset',
    entityType: 'user', entityId: userId, description: 'Password reset via token',
  })
  redirect('/login')
}
