import { requireSession } from '@/lib/tenant'
import { getOrganization } from '@/lib/repo/org'
import { AppShell } from '@/components/app-shell'
import { logoutAction } from '@/app/(auth)/actions'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSession()
  const org = await getOrganization(ctx)

  return (
    <AppShell
      orgName={org?.name ?? 'Memo Manager'}
      userName={ctx.user.name}
      userRole={ctx.user.role}
      // Wired to the real count once lib/repo/notifications.ts lands (Task 10).
      unreadCount={0}
      logoutAction={logoutAction}
    >
      {children}
    </AppShell>
  )
}
