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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        },
      },
    },
  );
}
