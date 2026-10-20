// ============================================================================
// Sign-in history — the writer behind /admin/traders/[id].
//
// `login_history` existed since migration 008 and the admin UI has always shown
// a "Login history" panel, but nothing in the codebase ever inserted a row: the
// panel could only ever say "No sign-in history recorded". Auth happens
// client-side (signInWithPassword / OAuth / magic link), so there is no server
// hook to intercept — the successful session is reported here immediately
// afterwards instead.
//
// Only successes are recorded. A wrong password never yields a session, so the
// caller cannot attribute a failure to a user id; Supabase Auth's own rate
// limiting covers that case.
// ============================================================================

import { createServiceClient } from '@/lib/supabase';

export interface LoginEvent {
  userId: string;
  email: string | null;
  /** 'email' | 'google' | 'magic_link' — free-form, mirrors migration 008. */
  provider: string;
  ip: string | null;
  userAgent: string | null;
}

/**
 * Two sign-ins within this window are one event: the login page also calls
 * `getUser()` while mounting, and a fast refresh immediately after signing in
 * would otherwise add a second identical row.
 */
const DEDUPE_WINDOW_MS = 120_000;

export async function recordLogin(event: LoginEvent): Promise<boolean> {
  try {
    const admin = createServiceClient();

    const { data: recent } = await admin
      .from('login_history')
      .select('id')
      .eq('user_id', event.userId)
      .gte('created_at', new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString())
      .limit(1);
    if (recent?.length) return false;

    const { error } = await admin.from('login_history').insert({
      user_id: event.userId,
      email: event.email,
      provider: event.provider,
      ip_address: event.ip,
      user_agent: event.userAgent?.slice(0, 300) ?? null,
      status: 'success',
    });

    // Never fail a sign-in because its audit trail could not be written.
    if (error) {
      console.error('login_history insert failed:', error.code);
      return false;
    }
    return true;
  } catch (error) {
    console.error(
      'login_history unavailable:',
      error instanceof Error ? error.message : 'unknown error',
    );
    return false;
  }
}

/** Best-effort client address from the proxy headers Vercel sets. */
export function clientIp(request: Request): string | null {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  );
}
