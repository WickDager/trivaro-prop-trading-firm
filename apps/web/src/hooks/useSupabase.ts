'use client';

import { createBrowserClient } from '@/lib/supabase';
import { useCallback } from 'react';

export function useSupabase() {
  const supabase = createBrowserClient();

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

  const signOut = useCallback(async () => {
    return supabase.auth.signOut();
  }, [supabase]);

  return { supabase, signInWithGoogle, signInWithEmail, signOut };
}
