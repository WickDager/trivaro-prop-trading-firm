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

function getSupabaseAnonKey(): string {
  return stripBOM(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder');
}

export function createBrowserClient() {
  return createSsrBrowserClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
}

export function createServerClient(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createSsrServerClient<Database>(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
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
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
  return createClient<Database>(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { getSupabaseUrl, getSupabaseAnonKey };
