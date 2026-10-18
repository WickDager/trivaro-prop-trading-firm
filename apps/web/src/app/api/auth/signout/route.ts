// ============================================================================
// POST /api/auth/signout — end the session and clear its cookies.
//
// WHY THIS IS A ROUTE AND NOT JUST `supabase.auth.signOut()`:
//
// Every `signOut()` scope in supabase-js makes a network call — for the default
// `global` scope it asks the Auth server to revoke ALL of the user's sessions,
// which is server-side work the customer then waits on behind the SDK's
// internal lock. With no redirect afterwards, "Sign Out" looked like it did
// nothing for seconds and then left a still-authenticated page on screen from
// the App Router's client cache.
//
// So the revocation here is BOUNDED (2s) and the cookie deletion is not
// conditional on it: whatever the Auth API does, the browser stops presenting a
// session, and the caller navigates with a full document load.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { getSupabasePublishableKey, getSupabaseUrl } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Session cookies written by @supabase/ssr: `sb-<project-ref>-auth-token`,
 * optionally chunked (`.0`, `.1`, …) plus the PKCE `-code-verifier`. Matching
 * the prefix rather than one guessed name means a chunked or renamed cookie
 * cannot survive a sign-out.
 */
const AUTH_COOKIE = /^sb-.*-auth-token/;

/** How long we are willing to wait for the Auth server to confirm revocation. */
const REVOKE_TIMEOUT_MS = 2_000;

export async function POST(request: NextRequest) {
  let revoked = false;

  try {
    const supabase = await createServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      const res = await fetch(`${getSupabaseUrl()}/auth/v1/logout?scope=global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: getSupabasePublishableKey(),
          Authorization: `Bearer ${session.access_token}`,
        },
        signal: AbortSignal.timeout(REVOKE_TIMEOUT_MS),
        cache: 'no-store',
      });
      revoked = res.ok;
      if (!res.ok) console.error('signout: revoke returned', res.status);
    }
  } catch (error) {
    // A timeout or an unreachable Auth server must not keep the customer signed
    // in on this device.
    console.error('signout: revoke failed:', error instanceof Error ? error.name : 'unknown');
  }

  const response = NextResponse.json(
    { ok: true, revoked },
    { headers: { 'Cache-Control': 'no-store, private' } },
  );

  const secure = process.env.NODE_ENV === 'production';
  for (const cookie of request.cookies.getAll()) {
    if (!AUTH_COOKIE.test(cookie.name)) continue;
    response.cookies.set({
      name: cookie.name,
      value: '',
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      sameSite: 'lax',
      secure,
    });
  }

  return response;
}
