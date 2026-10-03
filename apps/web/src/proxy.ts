import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const protectedPaths = ['/dashboard', '/challenge', '/payments', '/admin'];
// `/auth/*` is deliberately NOT listed. The callback route must run even for a
// user who already has a session, otherwise a magic-link / email-confirmation
// click is bounced to /dashboard before `exchangeCodeForSession` executes and
// the sign-in silently never completes.
const authPaths = ['/login'];

/** Matches the path itself and its children, but not sibling prefixes
 *  (`/challenge` matches `/challenge/123`, not `/challenges`). */
function matchesPath(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => matchesPath(pathname, p));
  const isAuthPage = authPaths.some((p) => matchesPath(pathname, p));

  const { supabase, supabaseResponse } = createServerClient(request);

  const { data: { user } } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const redirect = NextResponse.redirect(loginUrl);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirect;
  }

  if (isAuthPage && user) {
    const redirect = NextResponse.redirect(new URL('/dashboard', request.url));
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirect;
  }

  const response = supabaseResponse;

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
