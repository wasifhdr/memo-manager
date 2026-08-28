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
import { parseBulkUsers } from './bulk-parse'

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
      role: v.role, passwordHash,
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

export type BulkCreatedUser = { name: string; email: string; temporaryPassword: string }
export type BulkFailedRow = { line: number; email: string; message: string }
export type BulkCreateState =
  | { error: string }
  | { ok: true; created: BulkCreatedUser[]; failed: BulkFailedRow[] }
  | undefined

/**
 * Creates many users from pasted CSV. Rows are applied individually rather than
 * in one transaction: a single duplicate email should not discard the rest of
 * the batch, so every row reports its own outcome.
 */
export async function createUsersBulk(_prev: BulkCreateState, formData: FormData): Promise<BulkCreateState> {
  const ctx = await requireAdmin()
  const csv = formData.get('csv')
  if (typeof csv !== 'string' || !csv.trim()) return { error: 'Paste at least one row first.' }

  const { rows, errors } = parseBulkUsers(csv)
  if (rows.length === 0) {
    return { error: errors[0]?.message ?? 'Nothing to add — check the format and try again.' }
  }

  // Departments are given by name; resolve them once, scoped to this org.
  const orgDepartments = await db
    .select({ id: departments.id, name: departments.name })
    .from(departments)
    .where(eq(departments.orgId, ctx.orgId))
  const byName = new Map(orgDepartments.map((d) => [d.name.trim().toLowerCase(), d.id]))

  const created: BulkCreatedUser[] = []
  const failed: BulkFailedRow[] = errors.map((e) => ({ line: e.line, email: '', message: e.message }))

  for (const row of rows) {
    let departmentId: string | null = null
    if (row.department) {
      const match = byName.get(row.department.toLowerCase())
      if (!match) {
        failed.push({ line: row.line, email: row.email, message: `No department named "${row.department}".` })
        continue
      }
      departmentId = match
    }

    const temporaryPassword = generatePassword()
    const passwordHash = await hashPassword(temporaryPassword)

    try {
      const [user] = await db.insert(users).values({
        orgId: ctx.orgId, name: row.name, email: row.email,
        designation: row.designation || null, departmentId,
        role: row.role, passwordHash,
      }).returning()

      await audit(undefined, {
        orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'user_created',
        entityType: 'user', entityId: user.id,
        description: `User ${user.email} created (bulk import)`,
      })
      created.push({ name: user.name, email: user.email, temporaryPassword })
    } catch {
      failed.push({ line: row.line, email: row.email, message: 'A user with that email already exists.' })
    }
  }

  revalidatePath('/admin/users')
  return { ok: true, created, failed: failed.sort((a, b) => a.line - b.line) }
}
