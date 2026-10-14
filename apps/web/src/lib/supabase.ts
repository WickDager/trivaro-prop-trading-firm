import { createBrowserClient as createSsrBrowserClient, createServerClient as createSsrServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

function stripBOM(s: string): string {
  return s.replace(/^﻿/, '');
}

/** New-format browser-safe key. */
const PUBLISHABLE_KEY_PREFIX = 'sb_publishable_';

/** New-format server-only key. */
const SECRET_KEY_PREFIX = 'sb_secret_';

/** Legacy JWTs (anon / service_role) are recognisable by their `eyJ` header. */
const LEGACY_JWT_PREFIX = 'eyJ';

function getSupabaseUrl(): string {
  return stripBOM(process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321');
}

// Supabase renamed the browser-safe key from "anon key" to "publishable key".
// Accept either variable NAME: a deployment (or a local .env.local) that still
// holds the old name would otherwise fall through to "placeholder" and every
// auth call would come back as `{"message":"Invalid API key"}`, which points at
// the project instead of at the unset variable.
function getSupabasePublishableKey(): string {
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) {
    // Deliberately not thrown: this also runs during prerender, where the CI
    // build has no environment at all, and a throw would fail the build.
    console.error(
      '[supabase] No public Supabase key is configured. Set ' +
        'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or the legacy ' +
        'NEXT_PUBLIC_SUPABASE_ANON_KEY). Until then every auth request will ' +
        'fail with "Invalid API key".',
    );
    return 'placeholder';
  }

  const cleaned = stripBOM(key);

  // A NEXT_PUBLIC_* value is inlined into the browser bundle, so a secret key
  // here would publish a key that bypasses row-level security. Fail the build
  // rather than ship it.
  if (cleaned.startsWith(SECRET_KEY_PREFIX)) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a secret key. NEXT_PUBLIC_* ' +
        'values are inlined into the browser bundle, so this would expose a key ' +
        'that bypasses row-level security. Use the project publishable key ' +
        `("${PUBLISHABLE_KEY_PREFIX}...") instead.`,
    );
  }

  // Reported rather than thrown: there is no publishable key to fall back to
  // yet, so throwing would break local dev and builds without making sign-in
  // work. A legacy key can never silently succeed — Supabase rejects it.
  if (cleaned.startsWith(LEGACY_JWT_PREFIX)) {
    console.error(
      '[supabase] The configured public key is a legacy anon JWT, which ' +
        'Supabase has disabled. Sign-in will fail with "Legacy API keys are ' +
        `disabled" until this is replaced with an ${PUBLISHABLE_KEY_PREFIX}... ` +
        'key from Settings -> API Keys.',
    );
  }

  return cleaned;
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
  if (!key) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not defined. Set it to an ' +
        `"${SECRET_KEY_PREFIX}..." key from Supabase Settings -> API Keys. The ` +
        'legacy SUPABASE_SERVICE_ROLE_KEY variable is no longer accepted.',
    );
  }

  const cleaned = stripBOM(key);

  // Only the new-format secret key is usable. Supabase disabled the legacy
  // anon/service_role JWTs on 2026-10-07, so a value like this would fail every
  // query with "Legacy API keys are disabled" — reject it here, where the cause
  // is still legible.
  if (cleaned.startsWith(LEGACY_JWT_PREFIX)) {
    throw new Error(
      'SUPABASE_SECRET_KEY holds a legacy service_role JWT. Supabase has ' +
        'disabled legacy keys, so this value is rejected with "Legacy API keys ' +
        `are disabled". Replace it with an "${SECRET_KEY_PREFIX}..." key.`,
    );
  }
  if (!cleaned.startsWith(SECRET_KEY_PREFIX)) {
    throw new Error(
      `SUPABASE_SECRET_KEY must start with "${SECRET_KEY_PREFIX}" — it is not ` +
        'a valid Supabase secret key.',
    );
  }

  return createClient<Database>(getSupabaseUrl(), cleaned, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export { getSupabaseUrl, getSupabasePublishableKey };
