import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memoAttachments } from '@/db/schema'
import { getSession } from '@/lib/tenant'
import { getMemoAccess } from '@/lib/authz'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const ctx = await getSession()
  if (!ctx) return new NextResponse('Not found', { status: 404 })
  const { id } = await params

  const [att] = await db.select().from(memoAttachments)
    .where(and(eq(memoAttachments.id, id), eq(memoAttachments.orgId, ctx.orgId)))
    .limit(1)
  if (!att) return new NextResponse('Not found', { status: 404 })

  const access = await getMemoAccess(ctx, att.memoId)
  if (!access?.canView) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(new Uint8Array(att.data), {
    headers: {
      'Content-Type': att.mime,
      'Content-Length': String(att.sizeBytes),
      'Content-Disposition': `attachment; filename="${encodeURIComponent(att.filename)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
