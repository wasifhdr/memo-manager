import { requireAdmin } from '@/lib/tenant'
import { getOrganization } from '@/lib/repo/org'
import { unreadCount } from '@/lib/repo/notifications'
import { AppShell } from '@/components/app-shell'
import { AdminSubNav } from '@/components/admin-sub-nav'
import { logoutAction } from '@/app/(auth)/actions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin()
  const [org, unread] = await Promise.all([getOrganization(ctx), unreadCount(ctx)])

  return (
    <AppShell
      orgName={org?.name ?? 'Memo Manager'}
      hasLogo={!!org?.logo}
      userName={ctx.user.name}
      userRole={ctx.user.role}
      unreadCount={unread}
      logoutAction={logoutAction}
      secondaryNav={<AdminSubNav />}
    >
      {children}
    </AppShell>
  )
}
