import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';

const protectedPaths = ['/dashboard', '/challenge', '/payments', '/settings', '/admin'];
const authPaths = ['/login', '/auth'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));
  const isAuthPage = authPaths.some((p) => pathname.startsWith(p));

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
