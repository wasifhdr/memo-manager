import { and, count, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { notifications } from '@/db/schema'
import type { TenantContext } from '@/lib/tenant'

export async function listNotifications(ctx: TenantContext, opts?: { unreadOnly?: boolean; limit?: number }) {
  const limit = opts?.limit && opts.limit > 0 ? Math.min(opts.limit, 100) : 50
  return db.select().from(notifications)
    .where(and(
      eq(notifications.userId, ctx.user.id),
      opts?.unreadOnly ? isNull(notifications.readAt) : undefined,
    ))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function unreadCount(ctx: TenantContext): Promise<number> {
  const [{ n }] = await db.select({ n: count() }).from(notifications)
    .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)))
  return n
}

/** Scoped to the caller — a notification id belonging to someone else is a no-op. */
export async function markRead(ctx: TenantContext, notificationId: string): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, ctx.user.id)))
}

export async function markAllRead(ctx: TenantContext): Promise<void> {
  await db.update(notifications).set({ readAt: new Date() })
    .where(and(eq(notifications.userId, ctx.user.id), isNull(notifications.readAt)))
}
