import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC = ['/login', '/register-organization', '/forgot-password', '/reset-password']

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const hasCookie = req.cookies.has('memo_session')

  if (!isPublic && !hasCookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }
  if (isPublic && hasCookie && pathname === '/login') {
    const url = req.nextUrl.clone()
    url.pathname = '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)'],
}
