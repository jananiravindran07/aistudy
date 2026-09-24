import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

/**
 * Optimistic auth gate for the /app area (Next.js 16 renamed middleware → proxy).
 * Full session verification always happens again in the API routes / pages —
 * this only avoids a flash of the app shell for anonymous visitors.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (pathname.startsWith('/app') && !hasSession) {
    const login = new URL('/login', request.url);
    login.searchParams.set('from', pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};