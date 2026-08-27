import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memoAttachments, memos } from '@/db/schema'
import { getSession } from '@/lib/tenant'

export const runtime = 'nodejs'

// NOTE: upgraded in Task 7 to call lib/authz.ts's getMemoAccess once it
// exists, so a workflow participant (not just the author/an admin) can
// download too. Until then this is a strict subset of that eventual check,
// never a broader one.
async function canView(orgId: string, userId: string, role: string, memoId: string): Promise<boolean> {
  const [memo] = await db.select({ authorId: memos.authorId }).from(memos)
    .where(and(eq(memos.id, memoId), eq(memos.orgId, orgId)))
  if (!memo) return false
  return memo.authorId === userId || role === 'org_admin'
}

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

  const allowed = await canView(ctx.orgId, ctx.user.id, ctx.user.role, att.memoId)
  if (!allowed) return new NextResponse('Not found', { status: 404 })

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
