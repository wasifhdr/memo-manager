'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { departments } from '@/db/schema'
import { requireAdmin } from '@/lib/tenant'
import { audit } from '@/lib/audit'
import type { ActionState } from '@/app/(auth)/actions'

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(300).optional().or(z.literal('')),
})

export async function createDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Enter a department name.' }

  const [dept] = await db.insert(departments).values({
    orgId: ctx.orgId, name: parsed.data.name.trim(),
    description: parsed.data.description || null,
  }).returning()

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'department_created',
    entityType: 'department', entityId: dept.id, description: `Department "${dept.name}" created`,
  })
  revalidatePath('/admin/departments')
  return { ok: true }
}

const renameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(300).optional().or(z.literal('')),
})

export async function renameDepartment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = renameSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Enter a department name.' }

  const result = await db.update(departments)
    .set({ name: parsed.data.name.trim(), description: parsed.data.description || null })
    .where(and(eq(departments.id, parsed.data.id), eq(departments.orgId, ctx.orgId)))
    .returning({ id: departments.id })
  if (result.length === 0) return { error: 'Department not found.' }

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'department_updated',
    entityType: 'department', entityId: parsed.data.id, description: `Department renamed to "${parsed.data.name}"`,
  })
  revalidatePath('/admin/departments')
  return { ok: true }
}

const statusSchema = z.object({ id: z.string().uuid(), active: z.enum(['true', 'false']) })

export async function setDepartmentActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = statusSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }
  const active = parsed.data.active === 'true'

  const result = await db.update(departments)
    .set({ active })
    .where(and(eq(departments.id, parsed.data.id), eq(departments.orgId, ctx.orgId)))
    .returning({ id: departments.id })
  if (result.length === 0) return { error: 'Department not found.' }

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id,
    eventType: active ? 'department_activated' : 'department_deactivated',
    entityType: 'department', entityId: parsed.data.id,
    description: `Department ${active ? 'activated' : 'deactivated'}`,
  })
  revalidatePath('/admin/departments')
  return { ok: true }
}
