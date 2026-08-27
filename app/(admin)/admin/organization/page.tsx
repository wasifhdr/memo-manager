import type { Metadata } from 'next'
import { requireAdmin } from '@/lib/tenant'
import { getOrganization } from '@/lib/repo/org'
import { PageHeader } from '@/components/ui/page-header'
import { OrganizationProfileForm, LogoUploadForm } from './organization-forms'

export const metadata: Metadata = { title: 'Organization' }

export default async function OrganizationPage() {
  const ctx = await requireAdmin()
  const org = await getOrganization(ctx)
  if (!org) throw new Error('Organization not found for an authenticated session')

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Organization" description="Update your organization's profile and branding." />
      <OrganizationProfileForm
        org={{
          name: org.name, code: org.code, memoPrefix: org.config.memoPrefix,
          contactEmail: org.contactEmail, contactPhone: org.contactPhone, address: org.address,
        }}
      />
      <LogoUploadForm hasLogo={!!org.logo} />
    </div>
  )
}
