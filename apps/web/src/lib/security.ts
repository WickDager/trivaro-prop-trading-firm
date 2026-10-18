/**
 * Shared request-security helpers for cookie-authenticated route handlers.
 *
 * Session cookies from @supabase/ssr are `SameSite=Lax`, which already keeps
 * them off cross-site POSTs. The same-origin check is defence in depth: it
 * still refuses a request whose `Origin` names another host, so a future
 * change to cookie attributes (or a browser that mishandles Lax) does not
 * silently turn an admin write into a CSRF target.
 *
 * A missing `Origin` is allowed on purpose. Non-browser callers (curl, a
 * server-side job) cannot ride a victim's cookie, and same-origin form posts
 * can omit the header in older clients.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  const host = request.headers.get('host');
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Standard response headers for anything derived from the caller's session. */
export const PRIVATE_NO_STORE = { 'Cache-Control': 'no-store, private' } as const;
