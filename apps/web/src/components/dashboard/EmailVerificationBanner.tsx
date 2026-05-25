'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { AlertCircle, Loader2, MailCheck } from 'lucide-react';

export function EmailVerificationBanner() {
  const [status, setStatus] = useState<'loading' | 'unverified' | 'verified' | 'error'>('loading');

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data.user) {
        setStatus('error');
        return;
      }
      if (data.user.email_confirmed_at) {
        setStatus('verified');
      } else {
        setStatus('unverified');
      }
    });
  }, []);

  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  async function handleResend() {
    setResending(true);
    const supabase = createBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    await supabase.auth.resend({
      type: 'signup',
      email: user.email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResending(false);
    setResent(true);
  }

  if (status !== 'unverified') return null;

  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 sm:px-6 lg:px-8">
      <div className="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="flex-1">
          <p className="font-medium text-amber-400">Email not verified</p>
          <p className="mt-1 text-text-secondary">
            Check your inbox for the confirmation link. Some features are limited until your email is verified.
          </p>
        </div>
        <button
          onClick={handleResend}
          disabled={resending || resent}
          className="flex items-center gap-1.5 shrink-0 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20 disabled:opacity-50"
        >
          {resending ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending...</>
          ) : resent ? (
            <><MailCheck className="h-3.5 w-3.5" /> Sent</>
          ) : (
            'Resend'
          )}
        </button>
      </div>
    </div>
  );
}
