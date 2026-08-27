import { NextResponse } from 'next/server'
import { getSession } from '@/lib/tenant'
import { getMemoDetail } from '@/lib/repo/memo'
import { getOrganization } from '@/lib/repo/org'
import { buildMemoPdf } from '@/lib/pdf'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSession()
  if (!ctx) return new NextResponse('Not found', { status: 404 })
  const { id } = await params

  const detail = await getMemoDetail(ctx, id)
  if (!detail) return new NextResponse('Not found', { status: 404 })

  const org = await getOrganization(ctx)
  if (!org) return new NextResponse('Not found', { status: 404 })

  const bytes = await buildMemoPdf(detail, {
    name: org.name, code: org.code,
    contactEmail: org.contactEmail, contactPhone: org.contactPhone, address: org.address,
  })

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${detail.memo.memoNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
