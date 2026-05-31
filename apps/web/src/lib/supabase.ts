import { createClient } from '@supabase/supabase-js';
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

type SupabaseClient = ReturnType<typeof createClient<Database>>;

let browserClient: SupabaseClient | null = null;

export function createBrowserClient(): SupabaseClient {
  if (browserClient) return browserClient;
  browserClient = createClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return browserClient;
}

export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined');
  return createClient<Database>(getSupabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { getSupabaseUrl, getSupabaseAnonKey };
