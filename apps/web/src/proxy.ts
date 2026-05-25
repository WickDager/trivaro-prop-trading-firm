import { NextResponse, type NextRequest } from 'next/server';

const protectedPaths = ['/dashboard', '/challenge', '/payments', '/settings', '/admin'];
const authPaths = ['/login', '/auth'];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));

  const sessionCookie = request.cookies.get('sb-access-token')?.value
    ?? request.cookies.get('sb-refresh-token')?.value;

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPage && sessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const requestHeaders = new Headers(request.headers);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  return response;
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/challenge/:path*',
    '/payments/:path*',
    '/settings/:path*',
    '/admin/:path*',
    '/login/:path*',
    '/auth/:path*',
  ],
};
