import { requireAdmin } from '@/lib/tenant'
import { getOrganization } from '@/lib/repo/org'
import { AppShell } from '@/components/app-shell'
import { logoutAction } from '@/app/(auth)/actions'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin()
  const org = await getOrganization(ctx)

  return (
    <AppShell
      orgName={org?.name ?? 'Memo Manager'}
      hasLogo={!!org?.logo}
      userName={ctx.user.name}
      userRole={ctx.user.role}
      unreadCount={0}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  )
}
