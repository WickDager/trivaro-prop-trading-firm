// ============================================================================
// POST /api/auth/login-event — record a completed sign-in for the audit trail.
//
// The session is already established by the time this is called (the browser
// client wrote the cookies), and `getUser()` re-validates it server-side: an
// unauthenticated caller cannot write history, and `user_id` comes from the
// verified token rather than the request body, so a customer cannot attribute
// a login to somebody else.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { clientIp, recordLogin } from '@/lib/login-history';
import { isSameOrigin, PRIVATE_NO_STORE } from '@/lib/security';

const PROVIDERS = new Set(['email', 'google', 'magic_link']);

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ ok: false }, { status: 403, headers: PRIVATE_NO_STORE });
  }

  const { supabase } = createServerClient(request);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401, headers: PRIVATE_NO_STORE });
  }

  let provider = 'email';
  try {
    const body = (await request.json()) as { provider?: unknown };
    if (typeof body.provider === 'string' && PROVIDERS.has(body.provider)) {
      provider = body.provider;
    }
  } catch {
    // No body is fine — email/password is the default path.
  }

  const recorded = await recordLogin({
    userId: user.id,
    email: user.email ?? null,
    provider,
    ip: clientIp(request),
    userAgent: request.headers.get('user-agent'),
  });

  return NextResponse.json({ ok: true, recorded }, { headers: PRIVATE_NO_STORE });
}
