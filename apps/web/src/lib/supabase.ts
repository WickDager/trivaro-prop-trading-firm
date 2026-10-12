import { createBrowserClient as createSsrBrowserClient, createServerClient as createSsrServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function stripBOM(s: string): string {
  return s.replace(/^﻿/, '');
}

function getSupabaseUrl(): string {
  return stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321');
}

function getSupabasePublishableKey(): string {
  return stripBOM(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder');
}

export function createBrowserClient() {
  return createSsrBrowserClient<Database>(getSupabaseUrl(), getSupabasePublishableKey());
}

export function createServerClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createSsrServerClient<Database>(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  return { supabase, supabaseResponse };
}

export function createServiceClient() {
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) throw new Error('SUPABASE_SECRET_KEY is not defined');
  return createClient<Database>(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { getSupabaseUrl, getSupabasePublishableKey };
