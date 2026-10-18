'use client';

import { createBrowserClient } from '@/lib/supabase';
import { useCallback } from 'react';

/**
 * One browser client per tab.
 *
 * `useSupabase()` used to construct a client on every render, so an auth-aware
 * page built a new GoTrueClient (and re-ran session loading) several times a
 * second while scrolling. They share the same cookie storage, so they also
 * contend with each other during a token refresh — which is exactly when a
 * sign-out has to wait its turn.
 */
type BrowserClient = ReturnType<typeof createBrowserClient>;
let browserClient: BrowserClient | null = null;

function getBrowserClient(): BrowserClient {
  browserClient ??= createBrowserClient();
  return browserClient;
}

export function useSupabase() {
  const supabase = getBrowserClient();

  const signInWithGoogle = useCallback(async () => {
    return supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabase]);

  const signInWithEmail = useCallback(async (email: string) => {
    return supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabase]);

  /**
   * Sign out, then leave the page — properly.
   *
   * `signOut({ scope: 'global' })` (the default) is a network round trip that
   * asks the Auth server to revoke every session the user has, and the old
   * handler awaited it and then did nothing: no redirect, no cache reset, so
   * the page kept rendering the signed-in view and the button appeared broken.
   *
   * Now: the server clears the cookies (bounded, see /api/auth/signout) and the
   * browser performs a FULL navigation, which drops the App Router's cached
   * authenticated render and cannot be returned to with the Back button
   * (`replace`, not `push`).
   */
  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        cache: 'no-store',
        // Survives the navigation below even if the response is still in flight.
        keepalive: true,
      });
    } catch {
      // Offline or blocked. Fall back to the SDK, which clears the local
      // session even when its revocation request fails.
      void supabase.auth.signOut().catch(() => {});
    }

    window.location.replace('/login');
  }, [supabase]);

  return { supabase, signInWithGoogle, signInWithEmail, signOut };
}
