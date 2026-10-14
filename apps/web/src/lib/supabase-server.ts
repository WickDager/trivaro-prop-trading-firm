import { createServerClient as createSsrServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types';
// Reuse the guarded getters from lib/supabase.ts instead of duplicating them.
// The two copies had already drifted once — this file kept reading the legacy
// NEXT_PUBLIC_SUPABASE_ANON_KEY name after the other one was updated — so the
// key resolution (and its validation) now lives in exactly one place.
import { getSupabaseUrl, getSupabasePublishableKey } from '@/lib/supabase';

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSsrServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          // Called during token refresh. When this client is used from a Server
          // Component (the dashboard/admin layouts), Next throws "Cookies can
          // only be modified in a Server Action or Route Handler" — which would
          // take down the whole layout roughly once an hour, when the access
          // token expires. Swallowing it is the documented pattern: the refresh
          // still happens, and proxy.ts persists the new cookies on the next
          // request.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Intentionally ignored — see above.
          }
        },
      },
    },
  );
}
