import { redirect } from 'next/navigation'
import { getSession } from '@/lib/tenant'

export default async function RootPage() {
  const ctx = await getSession()
  redirect(ctx ? '/dashboard' : '/login')
}
