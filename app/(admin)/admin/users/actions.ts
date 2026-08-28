'use server'

import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { users, departments } from '@/db/schema'
import { requireAdmin } from '@/lib/tenant'
import { hashPassword, revokeUserSessions, createPasswordResetToken } from '@/lib/auth'
import { audit } from '@/lib/audit'
import type { ActionState } from '@/app/(auth)/actions'
import { validateBulkUsers, BULK_PASSWORD_MIN, type BulkUserDraft } from './bulk-users'

export type CreateUserState =
  | { error: string }
  | { ok: true; email: string; temporaryPassword: string }
  | undefined

function generatePassword(): string {
  // 16 chars from a base64url alphabet — well above the 10-char minimum,
  // shown to the admin exactly once.
  return randomBytes(12).toString('base64url')
}

const createSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  designation: z.string().max(120).optional().or(z.literal('')),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  role: z.enum(['org_admin', 'user']),
})

export async function createUser(_prev: CreateUserState, formData: FormData): Promise<CreateUserState> {
  const ctx = await requireAdmin()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const v = parsed.data

  if (v.departmentId) {
    const [dept] = await db.select({ id: departments.id }).from(departments)
      .where(and(eq(departments.id, v.departmentId), eq(departments.orgId, ctx.orgId)))
    if (!dept) return { error: 'That department does not belong to your organization.' }
  }

  const temporaryPassword = generatePassword()
  const passwordHash = await hashPassword(temporaryPassword)

  try {
    const [user] = await db.insert(users).values({
      orgId: ctx.orgId, name: v.name.trim(), email: v.email.trim().toLowerCase(),
      designation: v.designation || null, departmentId: v.departmentId || null,
      role: v.role, passwordHash, mustChangePassword: true,
    }).returning()

    await audit(undefined, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'user_created',
      entityType: 'user', entityId: user.id, description: `User ${user.email} created`,
    })
    revalidatePath('/admin/users')
    return { ok: true, email: user.email, temporaryPassword }
  } catch {
    return { error: 'A user with that email already exists in this organization.' }
  }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  designation: z.string().max(120).optional().or(z.literal('')),
  departmentId: z.string().uuid().optional().or(z.literal('')),
  role: z.enum(['org_admin', 'user']),
})

export async function updateUser(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Check the form and try again.' }
  const v = parsed.data

  if (v.departmentId) {
    const [dept] = await db.select({ id: departments.id }).from(departments)
      .where(and(eq(departments.id, v.departmentId), eq(departments.orgId, ctx.orgId)))
    if (!dept) return { error: 'That department does not belong to your organization.' }
  }

  const result = await db.update(users)
    .set({
      name: v.name.trim(), designation: v.designation || null,
      departmentId: v.departmentId || null, role: v.role,
    })
    .where(and(eq(users.id, v.id), eq(users.orgId, ctx.orgId)))
    .returning({ id: users.id })
  if (result.length === 0) return { error: 'User not found.' }

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'user_updated',
    entityType: 'user', entityId: v.id, description: `User updated`,
  })
  revalidatePath('/admin/users')
  return { ok: true }
}

const statusSchema = z.object({ id: z.string().uuid(), status: z.enum(['active', 'inactive']) })

export async function setUserStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = statusSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  if (parsed.data.id === ctx.user.id && parsed.data.status === 'inactive') {
    return { error: 'You cannot deactivate your own account.' }
  }

  const result = await db.update(users)
    .set({ status: parsed.data.status })
    .where(and(eq(users.id, parsed.data.id), eq(users.orgId, ctx.orgId)))
    .returning({ id: users.id })
  if (result.length === 0) return { error: 'User not found.' }

  if (parsed.data.status === 'inactive') {
    await revokeUserSessions(parsed.data.id)
  }

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id,
    eventType: parsed.data.status === 'active' ? 'user_activated' : 'user_deactivated',
    entityType: 'user', entityId: parsed.data.id,
    description: `User ${parsed.data.status === 'active' ? 'activated' : 'deactivated'}`,
  })
  revalidatePath('/admin/users')
  return { ok: true }
}

export type ResetLinkState = { error: string } | { ok: true; url: string } | undefined

const resetLinkSchema = z.object({ id: z.string().uuid() })

export async function generateResetLink(_prev: ResetLinkState, formData: FormData): Promise<ResetLinkState> {
  const ctx = await requireAdmin()
  const parsed = resetLinkSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  const [user] = await db.select().from(users)
    .where(and(eq(users.id, parsed.data.id), eq(users.orgId, ctx.orgId)))
  if (!user) return { error: 'User not found.' }

  const raw = await createPasswordResetToken(user.id)
  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'password_reset_link_generated',
    entityType: 'user', entityId: user.id, description: `Reset link generated for ${user.email}`,
  })
  return { ok: true, url: `/reset-password/${raw}` }
}

export type BulkCreatedUser = { name: string; email: string }
export type BulkFailedRow = { row: number; email: string; message: string }
export type BulkCreateState =
  | { error: string }
  | { ok: true; created: BulkCreatedUser[]; sharedPassword: string; failed: BulkFailedRow[] }
  | undefined

/**
 * Creates many users at once, all sharing one administrator-chosen temporary
 * password. Every account is flagged to change it on first sign-in.
 *
 * Rows are applied individually rather than in one transaction: a single
 * duplicate email should not discard the rest of the batch, so every row
 * reports its own outcome.
 */
export async function createUsersBulk(_prev: BulkCreateState, formData: FormData): Promise<BulkCreateState> {
  const ctx = await requireAdmin()

  const sharedPassword = formData.get('sharedPassword')
  if (typeof sharedPassword !== 'string' || sharedPassword.length < BULK_PASSWORD_MIN) {
    return { error: `The shared password needs at least ${BULK_PASSWORD_MIN} characters.` }
  }

  const raw = formData.get('users')
  if (typeof raw !== 'string') return { error: 'Nothing to add.' }

  let drafts: BulkUserDraft[]
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) throw new Error('not an array')
    drafts = parsed as BulkUserDraft[]
  } catch {
    return { error: 'Could not read the submitted rows.' }
  }

  const { valid, errors } = validateBulkUsers(drafts)
  if (valid.length === 0) {
    return { error: errors[0]?.message ?? 'Fill in at least one user.' }
  }

  // Every department id must belong to the caller's own organization; an id
  // from anywhere else simply will not be in this set.
  const orgDepartments = await db
    .select({ id: departments.id })
    .from(departments)
    .where(eq(departments.orgId, ctx.orgId))
  const allowed = new Set(orgDepartments.map((d) => d.id))

  // One hash for the whole batch — the password is shared, and bcrypt is the
  // expensive part of this request.
  const passwordHash = await hashPassword(sharedPassword)

  const created: BulkCreatedUser[] = []
  const failed: BulkFailedRow[] = errors.map((e) => ({ row: e.index + 1, email: '', message: e.message }))

  for (const { index, draft } of valid) {
    if (draft.departmentId && !allowed.has(draft.departmentId)) {
      failed.push({ row: index + 1, email: draft.email, message: 'That department is not in your organization.' })
      continue
    }

    try {
      const [user] = await db.insert(users).values({
        orgId: ctx.orgId, name: draft.name, email: draft.email,
        designation: draft.designation || null,
        departmentId: draft.departmentId || null,
        role: draft.role, passwordHash, mustChangePassword: true,
      }).returning()

      await audit(undefined, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'user_created',
        entityType: 'user', entityId: user.id,
        description: `User ${user.email} created (bulk)`,
      })
      created.push({ name: user.name, email: user.email })
    } catch {
      failed.push({ row: index + 1, email: draft.email, message: 'A user with that email already exists.' })
    }
  }

  revalidatePath('/admin/users')
  return { ok: true, created, sharedPassword, failed: failed.sort((a, b) => a.row - b.row) }
}
