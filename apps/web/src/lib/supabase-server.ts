import { createServerClient as createSsrServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types';

function stripBOM(s: string): string {
  return s.replace(/^﻿/, '');
}

function getSupabaseUrl(): string {
  return stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321');
}

function getSupabaseAnonKey(): string {
  return stripBOM(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder');
}

export async function createServerClient() {
  const cookieStore = await cookies();

  return createSsrServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
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
