'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { requireSession } from '@/lib/tenant'
import { markRead, markAllRead } from '@/lib/repo/notifications'
import type { ActionState } from '@/app/(auth)/actions'

const idSchema = z.object({ id: z.string().uuid() })

export async function markNotificationReadAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const ctx = await requireSession()
  const parsed = idSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Invalid request.' }

  await markRead(ctx, parsed.data.id)
  revalidatePath('/notifications')
  return { ok: true }
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const ctx = await requireSession()
  await markAllRead(ctx)
  revalidatePath('/notifications')
}
