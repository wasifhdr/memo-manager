import { db, type Executor } from '@/lib/db'
import { notifications } from '@/db/schema'
import type { NotificationType } from '@/db/schema'

export async function notify(ex: Executor = db, o: {
  orgId: string; userId: string; type: NotificationType
  memoId?: string | null; title: string; body?: string | null
}): Promise<void> {
  await ex.insert(notifications).values({
    orgId: o.orgId, userId: o.userId, type: o.type,
    memoId: o.memoId ?? null, title: o.title, body: o.body ?? null,
  })
}

export async function notifyMany(ex: Executor, userIds: string[], o: {
  orgId: string; type: NotificationType; memoId?: string | null; title: string; body?: string | null
}): Promise<void> {
  const unique = [...new Set(userIds)]
  if (unique.length === 0) return
  await ex.insert(notifications).values(unique.map((userId) => ({
    orgId: o.orgId, userId, type: o.type,
    memoId: o.memoId ?? null, title: o.title, body: o.body ?? null,
  })))
}
