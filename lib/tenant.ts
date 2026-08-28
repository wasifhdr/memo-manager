import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { resolveSession, type SessionUser } from '@/lib/auth'

export const SESSION_COOKIE = 'memo_session'

/**
 * The only carrier of organization scope in the application.
 * It is constructible ONLY from a verified session — no function anywhere
 * accepts a caller-supplied orgId.
 */
export type TenantContext = { orgId: string; user: SessionUser }

export const getSession = cache(async (): Promise<TenantContext | null> => {
  const jar = await cookies()
  const raw = jar.get(SESSION_COOKIE)?.value
  if (!raw) return null
  const user = await resolveSession(raw)
  if (!user) return null
  return { orgId: user.orgId, user }
})

/** Where a user on an administrator-issued password is held until they pick
 * their own. Exported so the gate and the page cannot drift apart. */
export const CHANGE_PASSWORD_PATH = '/change-password'

export async function requireSession(
  opts?: {
    /** Only the change-password screen itself sets this — every other caller
     * must stay behind the gate, otherwise the redirect would loop. */
    allowPendingPasswordChange?: boolean
  },
): Promise<TenantContext> {
  const ctx = await getSession()
  if (!ctx) redirect('/login')
  if (ctx.user.mustChangePassword && !opts?.allowPendingPasswordChange) {
    redirect(CHANGE_PASSWORD_PATH)
  }
  return ctx
}

export async function requireAdmin(): Promise<TenantContext> {
  const ctx = await requireSession()
  if (ctx.user.role !== 'org_admin') redirect('/dashboard')
  return ctx
}

export async function setSessionCookie(raw: string): Promise<void> {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}
