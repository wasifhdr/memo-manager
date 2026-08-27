'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { organizations } from '@/db/schema'
import { requireAdmin } from '@/lib/tenant'
import { audit } from '@/lib/audit'
import type { ActionState } from '@/app/(auth)/actions'

const updateSchema = z.object({
  name: z.string().min(2).max(120),
  code: z.string().min(2).max(12).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and hyphens only.'),
  memoPrefix: z.string().min(1).max(12).regex(/^[A-Za-z0-9-]+$/, 'Letters, numbers and hyphens only.'),
  contactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().max(40).optional().or(z.literal('')),
  address: z.string().max(300).optional().or(z.literal('')),
})

export async function updateOrganization(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const v = parsed.data

  await db.update(organizations).set({
    name: v.name.trim(), code: v.code.trim().toUpperCase(),
    config: { memoPrefix: v.memoPrefix.trim().toUpperCase() },
    contactEmail: v.contactEmail || null,
    contactPhone: v.contactPhone || null,
    address: v.address || null,
  }).where(eq(organizations.id, ctx.orgId))

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'organization_updated',
    entityType: 'organization', entityId: ctx.orgId, description: 'Organization profile updated',
  })
  revalidatePath('/admin/organization')
  return { ok: true }
}

const ALLOWED_LOGO_MIME = new Set(['image/png', 'image/jpeg', 'image/svg+xml'])
const MAX_LOGO_BYTES = 512 * 1024

export async function uploadLogo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const file = formData.get('logo')
  if (!(file instanceof File) || file.size === 0) return { error: 'Choose an image file.' }
  if (!ALLOWED_LOGO_MIME.has(file.type)) return { error: 'Logo must be a PNG, JPEG or SVG image.' }
  if (file.size > MAX_LOGO_BYTES) return { error: 'Logo must be 512 KB or smaller.' }

  const bytes = Buffer.from(await file.arrayBuffer())
  await db.update(organizations)
    .set({ logo: bytes, logoMime: file.type })
    .where(eq(organizations.id, ctx.orgId))

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'organization_logo_updated',
    entityType: 'organization', entityId: ctx.orgId, description: 'Organization logo updated',
  })
  revalidatePath('/admin/organization')
  return { ok: true }
}
