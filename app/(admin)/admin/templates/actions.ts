'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { workflowTemplates, workflowTemplateSteps } from '@/db/schema'
import { requireAdmin } from '@/lib/tenant'
import { audit } from '@/lib/audit'
import type { ActionState } from '@/app/(auth)/actions'

const stepInput = z.object({
  positionTitle: z.string().min(1).max(120),
  requiredAction: z.enum(['approve', 'review']),
})

const stepsSchema = z.string().transform((s, ctx) => {
  try {
    return z.array(stepInput).min(1, 'Add at least one step.').parse(JSON.parse(s))
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Invalid template steps.' })
    return z.NEVER
  }
})

const createSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(300).optional().or(z.literal('')),
  steps: stepsSchema,
})

export async function createTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const v = parsed.data

  await db.transaction(async (tx) => {
    const [tpl] = await tx.insert(workflowTemplates).values({
      orgId: ctx.orgId, name: v.name.trim(), description: v.description || null,
    }).returning()
    await tx.insert(workflowTemplateSteps).values(v.steps.map((s, i) => ({
      orgId: ctx.orgId, templateId: tpl.id, stepNo: i + 1,
      positionTitle: s.positionTitle, requiredAction: s.requiredAction,
    })))
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'workflow_template_created',
      entityType: 'workflow_template', entityId: tpl.id, description: `Template "${tpl.name}" created`,
    })
  })

  revalidatePath('/admin/templates')
  return { ok: true }
}

const updateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(120),
  description: z.string().max(300).optional().or(z.literal('')),
  steps: stepsSchema,
})

export async function updateTemplate(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = updateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form and try again.' }
  const v = parsed.data

  const [existing] = await db.select({ id: workflowTemplates.id }).from(workflowTemplates)
    .where(and(eq(workflowTemplates.id, v.id), eq(workflowTemplates.orgId, ctx.orgId)))
  if (!existing) return { error: 'Template not found.' }

  await db.transaction(async (tx) => {
    await tx.update(workflowTemplates)
      .set({ name: v.name.trim(), description: v.description || null })
      .where(eq(workflowTemplates.id, v.id))
    // Steps carry no independent identity worth preserving — replace them wholesale.
    await tx.delete(workflowTemplateSteps).where(eq(workflowTemplateSteps.templateId, v.id))
    await tx.insert(workflowTemplateSteps).values(v.steps.map((s, i) => ({
      orgId: ctx.orgId, templateId: v.id, stepNo: i + 1,
      positionTitle: s.positionTitle, requiredAction: s.requiredAction,
    })))
    await audit(tx, {
      orgId: ctx.orgId, actorId: ctx.user.id, eventType: 'workflow_template_updated',
      entityType: 'workflow_template', entityId: v.id, description: `Template "${v.name}" updated`,
    })
  })

  revalidatePath('/admin/templates')
  return { ok: true }
}

const statusSchema = z.object({ id: z.string().uuid(), active: z.enum(['true', 'false']) })

export async function setTemplateActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireAdmin()
  const parsed = statusSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }
  const active = parsed.data.active === 'true'

  const result = await db.update(workflowTemplates).set({ active })
    .where(and(eq(workflowTemplates.id, parsed.data.id), eq(workflowTemplates.orgId, ctx.orgId)))
    .returning({ id: workflowTemplates.id })
  if (result.length === 0) return { error: 'Template not found.' }

  await audit(undefined, {
    orgId: ctx.orgId, actorId: ctx.user.id,
    eventType: active ? 'workflow_template_activated' : 'workflow_template_deactivated',
    entityType: 'workflow_template', entityId: parsed.data.id,
    description: `Template ${active ? 'activated' : 'deactivated'}`,
  })
  revalidatePath('/admin/templates')
  return { ok: true }
}
