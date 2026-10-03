import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';

/**
 * Only ever bounce back to a same-origin, absolute path. Without this,
 * `?next=@evil.com` produces `https://site.com@evil.com`, which `URL` parses as
 * host `evil.com` — an open redirect hanging off the trusted login flow.
 */
function safeNext(next: string | null): string {
  if (!next) return '/dashboard';
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/dashboard';
  }
  return next;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeNext(searchParams.get('next'));

  // CSRF protection comes from the PKCE `code_verifier` bound to the browser
  // that started the flow. (The previous x-auth-state header check was dead
  // code — no client ever set that header — so it only gave false assurance.)
  if (code) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
