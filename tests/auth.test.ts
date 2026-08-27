import { describe, it, expect, beforeAll } from 'vitest'
import { resetDb } from './helpers/db'
import { db } from '@/lib/db'
import { organizations, users, sessions } from '@/db/schema'
import { eq } from 'drizzle-orm'
import {
  hashPassword, verifyPassword, createSession, resolveSession, destroySession,
  revokeUserSessions, createPasswordResetToken, consumePasswordResetToken, hashToken,
} from '@/lib/auth'

let userId: string
let orgId: string

beforeAll(async () => {
  await resetDb()
  const [org] = await db.insert(organizations)
    .values({ name: 'NBU', slug: 'nbu', code: 'NBU' }).returning()
  orgId = org.id
  const [u] = await db.insert(users).values({
    orgId, name: 'Ayesha', email: 'a@nbu.test',
    passwordHash: await hashPassword('correct horse'),
  }).returning()
  userId = u.id
})

describe('passwords', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('s3cret')
    expect(hash).not.toContain('s3cret')
    expect(await verifyPassword('s3cret', hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})

describe('sessions', () => {
  it('stores only a hash of the token', async () => {
    const raw = await createSession(userId)
    const rows = await db.select().from(sessions).where(eq(sessions.userId, userId))
    expect(rows.some((r) => r.tokenHash === raw)).toBe(false)
    expect(rows.some((r) => r.tokenHash === hashToken(raw))).toBe(true)
  })

  it('resolves a valid token to the user with their org', async () => {
    const raw = await createSession(userId)
    const su = await resolveSession(raw)
    expect(su?.id).toBe(userId)
    expect(su?.orgId).toBe(orgId)
  })

  it('returns null for an unknown token', async () => {
    expect(await resolveSession('not-a-real-token')).toBeNull()
  })

  it('returns null after the session is destroyed', async () => {
    const raw = await createSession(userId)
    await destroySession(raw)
    expect(await resolveSession(raw)).toBeNull()
  })

  it('refuses to resolve a session whose user is inactive', async () => {
    const raw = await createSession(userId)
    await db.update(users).set({ status: 'inactive' }).where(eq(users.id, userId))
    expect(await resolveSession(raw)).toBeNull()
    await db.update(users).set({ status: 'active' }).where(eq(users.id, userId))
  })

  it('revokes every session for a user', async () => {
    const a = await createSession(userId)
    const b = await createSession(userId)
    await revokeUserSessions(userId)
    expect(await resolveSession(a)).toBeNull()
    expect(await resolveSession(b)).toBeNull()
  })
})

describe('password reset tokens', () => {
  it('is single use', async () => {
    const raw = await createPasswordResetToken(userId)
    expect(await consumePasswordResetToken(raw)).toBe(userId)
    expect(await consumePasswordResetToken(raw)).toBeNull()
  })

  it('rejects an unknown token', async () => {
    expect(await consumePasswordResetToken('nope')).toBeNull()
  })
})
