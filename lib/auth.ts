import { createHash, randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { and, eq, gt, isNull, lt } from 'drizzle-orm'
import { db, type Executor } from '@/lib/db'
import { sessions, users, passwordResetTokens } from '@/db/schema'
import type { Role, UserStatus } from '@/db/schema'

const BCRYPT_COST = 12
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7
const RESET_TTL_MS = 1000 * 60 * 60

export type SessionUser = {
  id: string
  orgId: string
  name: string
  email: string
  role: Role
  status: UserStatus
  departmentId: string | null
  designation: string | null
}

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export async function createSession(userId: string, userAgent?: string | null): Promise<string> {
  const raw = randomBytes(32).toString('base64url')
  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(raw),
    userAgent: userAgent ?? null,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  })
  return raw
}

export async function resolveSession(rawToken: string): Promise<SessionUser | null> {
  const [row] = await db
    .select({
      id: users.id, orgId: users.orgId, name: users.name, email: users.email,
      role: users.role, status: users.status,
      departmentId: users.departmentId, designation: users.designation,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(
      eq(sessions.tokenHash, hashToken(rawToken)),
      gt(sessions.expiresAt, new Date()),
      eq(users.status, 'active'),
    ))
    .limit(1)
  return row ?? null
}

export async function destroySession(rawToken: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(rawToken)))
}

export async function revokeUserSessions(userId: string, ex: Executor = db): Promise<void> {
  await ex.delete(sessions).where(eq(sessions.userId, userId))
}

export async function createPasswordResetToken(userId: string): Promise<string> {
  const raw = randomBytes(32).toString('base64url')
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + RESET_TTL_MS),
  })
  return raw
}

export async function consumePasswordResetToken(rawToken: string): Promise<string | null> {
  const [row] = await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(and(
      eq(passwordResetTokens.tokenHash, hashToken(rawToken)),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, new Date()),
    ))
    .returning({ userId: passwordResetTokens.userId })
  return row?.userId ?? null
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
}
