'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memoCategories } from '@/db/schema'
import { requireAdmin } from '@/lib/tenant'
import { audit } from '@/lib/audit'
import type { ActionState } from '@/app/(auth)/actions'

const createSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional().or(z.literal('')),
})

export async function createCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Enter a category name.' }

  const [cat] = await db.insert(memoCategories).values({
    orgId: ctx.orgId, name: parsed.data.name.trim(), description: parsed.data.description || null,
  }).returning()

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'category_created',
    entityType: 'memo_category', entityId: cat.id, description: `Category "${cat.name}" created`,
  })
  revalidatePath('/admin/categories')
  return { ok: true }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(80),
  description: z.string().max(300).optional().or(z.literal('')),
})

export async function updateCategory(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Enter a category name.' }

  const result = await db.update(memoCategories)
    .set({ name: parsed.data.name.trim(), description: parsed.data.description || null })
    .where(and(eq(memoCategories.id, parsed.data.id), eq(memoCategories.orgId, ctx.orgId)))
    .returning({ id: memoCategories.id })
  if (result.length === 0) return { error: 'Category not found.' }

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'category_updated',
    entityType: 'memo_category', entityId: parsed.data.id, description: `Category updated to "${parsed.data.name}"`,
  })
  revalidatePath('/admin/categories')
  return { ok: true }
}

const statusSchema = z.object({ id: z.string().uuid(), active: z.enum(['true', 'false']) })

export async function setCategoryActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = statusSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }
  const active = parsed.data.active === 'true'

  const result = await db.update(memoCategories)
    .set({ active })
    .where(and(eq(memoCategories.id, parsed.data.id), eq(memoCategories.orgId, ctx.orgId)))
    .returning({ id: memoCategories.id })
  if (result.length === 0) return { error: 'Category not found.' }

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id,
    eventType: active ? 'category_activated' : 'category_deactivated',
    entityType: 'memo_category', entityId: parsed.data.id,
    description: `Category ${active ? 'activated' : 'deactivated'}`,
  })
  revalidatePath('/admin/categories')
  return { ok: true }
}
