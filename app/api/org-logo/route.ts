import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { organizations } from '@/db/schema'
import { getSession } from '@/lib/tenant'

export const runtime = 'nodejs'

export async function GET() {
  const ctx = await getSession()
  if (!ctx) return new NextResponse('Not found', { status: 404 })

  const [org] = await db.select({ logo: organizations.logo, logoMime: organizations.logoMime })
    .from(organizations).where(eq(organizations.id, ctx.orgId)).limit(1)
  if (!org?.logo || !org.logoMime) return new NextResponse('Not found', { status: 404 })

  return new NextResponse(new Uint8Array(org.logo), {
    headers: {
      'Content-Type': org.logoMime,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
