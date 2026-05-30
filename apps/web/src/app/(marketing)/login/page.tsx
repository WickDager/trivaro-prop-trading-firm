'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';
import { GlowButton } from '@/components/shared/GlowButton';
import { useSupabase } from '@/hooks/useSupabase';
import {
  Mail, Lock, Chrome, SendHorizonal,
  Eye, EyeOff, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react';

type AuthMode = 'signin' | 'signup';
type AuthStep = 'idle' | 'loading' | 'magic_link_sent' | 'check_email';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') ?? '/dashboard';
  const { supabase, signInWithGoogle } = useSupabase();

  const [mode, setMode] = useState<AuthMode>('signin');
  const [step, setStep] = useState<AuthStep>('idle');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (data.user) {
        router.push(redirect);
      } else if (error && error.message.includes('ISO-8859')) {
        // Clear corrupted localStorage from previous broken deployments
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-')) localStorage.removeItem(key);
        });
        window.location.reload();
      }
    }).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('ISO-8859')) {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sb-')) localStorage.removeItem(key);
        });
        window.location.reload();
      }
    });
  }, [supabase, router, redirect]);

  async function handleEmailSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (mode === 'signup') {
      const validationErrors = validatePassword(password);
      if (validationErrors.length > 0) {
        setPasswordErrors(validationErrors);
        return;
      }
      setPasswordErrors([]);
    }

    setStep('loading');

    if (mode === 'signin') {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        if (signInError.message.toLowerCase().includes('email not confirmed')) {
          setUnconfirmedEmail(email);
        }
        setError(signInError.message);
        setStep('idle');
        return;
      }
      router.push(redirect);
    } else {
      try {
        // Use direct fetch to avoid Supabase client header encoding issue in Turbopack builds
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/signup`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              'X-Supabase-Api-Version': '2024-01-01',
            },
            body: JSON.stringify({
              email,
              password,
              data: { first_name: firstName, last_name: lastName },
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({ msg: res.statusText }));
          setError(err.msg || err.message || 'Signup failed');
          setStep('idle');
          return;
        }
        // Sign them out so they must verify email before accessing dashboard
        await supabase.auth.signOut();
        setStep('check_email');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection error. Please check your network and try again.');
        setStep('idle');
      }
    }
  }

  function validatePassword(pw: string): string[] {
    const errors: string[] = [];
    if (pw.length < 8) errors.push('At least 8 characters');
    if (!/[A-Z]/.test(pw)) errors.push('One uppercase letter');
    if (!/[0-9]/.test(pw)) errors.push('One number');
    if (!/[^A-Za-z0-9]/.test(pw)) errors.push('One special character');
    if (/\s/.test(pw)) errors.push('No spaces allowed');
    return errors;
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Enter your email first'); return; }
    setError(null);
    setStep('loading');

    const { error: magicError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (magicError) {
      setError(magicError.message);
      setStep('idle');
      return;
    }
    setStep('magic_link_sent');
  }

  async function handleGoogleSignIn() {
    setError(null);
    setStep('loading');
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      setError(googleError.message);
      setStep('idle');
    }
  }

  if (step === 'check_email') {
    return (
      <div className="min-h-screen pt-24">
        <div className="mx-auto max-w-md px-4 py-20">
          <RevealOnScroll>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-8 text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/10">
                <CheckCircle2 className="h-8 w-8 text-green-400" />
              </div>
              <h1 className="mb-2 font-heading text-2xl font-bold">Verify Your Email</h1>
              <p className="mb-2 text-sm text-text-secondary">
                We sent a confirmation link to <span className="text-teal-400">{email}</span>
              </p>
              <p className="text-xs text-text-muted">
                You must verify your email before you can sign in. Check your inbox (and spam folder) for the confirmation email.
              </p>
              <button
                onClick={() => { setStep('idle'); setMode('signin'); }}
                className="mt-6 text-sm text-teal-400 hover:underline"
              >
                Back to Sign In
              </button>
            </motion.div>
          </RevealOnScroll>
        </div>
      </div>
    );
  }

  if (step === 'magic_link_sent') {
    return (
      <div className="min-h-screen pt-24">
        <div className="mx-auto max-w-md px-4 py-20">
          <RevealOnScroll>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-8 text-center"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10">
                <SendHorizonal className="h-8 w-8 text-teal-400" />
              </div>
              <h1 className="mb-2 font-heading text-2xl font-bold">Magic Link Sent</h1>
              <p className="mb-2 text-sm text-text-secondary">
                Check <span className="text-teal-400">{email}</span> for your login link.
              </p>
              <p className="text-xs text-text-muted">
                No email? Check spam or try again.
              </p>
              <button
                onClick={() => { setStep('idle'); }}
                className="mt-6 text-sm text-teal-400 hover:underline"
              >
                Back to Sign In
              </button>
            </motion.div>
          </RevealOnScroll>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-md px-4 py-12">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-4xl font-bold">
              {mode === 'signin' ? 'Welcome' : 'Create'} <GradientText as="span">Account</GradientText>
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
              {mode === 'signin'
                ? 'Sign in to access your trading dashboard'
                : 'Start your journey to becoming a funded trader'}
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1}>
          <div className="mt-10 rounded-xl border border-teal-500/10 bg-navy-700/60 p-8">
            {(error || passwordErrors.length > 0) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1">
                    {passwordErrors.length > 0 ? (
                      <ul className="list-inside list-disc space-y-0.5">
                        {passwordErrors.map((e) => <li key={e}>{e}</li>)}
                      </ul>
                    ) : (
                      <span>{error}</span>
                    )}
                    {unconfirmedEmail && (
                      <button
                        onClick={async () => {
                          setError(null);
                          setStep('loading');
                          const { error: resendError } = await supabase.auth.resend({
                            type: 'signup',
                            email: unconfirmedEmail,
                            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
                          });
                          setStep('idle');
                          if (resendError) {
                            setError(resendError.message);
                          } else {
                            setStep('check_email');
                          }
                        }}
                        className="ml-2 text-teal-400 hover:underline"
                      >
                        Resend verification email
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            <form onSubmit={handleEmailSignIn} className="space-y-4">
              {mode === 'signup' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="firstName" className="mb-1.5 block text-sm text-text-secondary">First Name</label>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-lg border border-teal-500/10 bg-navy-800 py-2.5 px-3 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="mb-1.5 block text-sm text-text-secondary">Last Name</label>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-lg border border-teal-500/10 bg-navy-800 py-2.5 px-3 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                      placeholder="Doe"
                    />
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm text-text-secondary">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-teal-500/10 bg-navy-800 py-2.5 pl-10 pr-4 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm text-text-secondary">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-teal-500/10 bg-navy-800 py-2.5 pl-10 pr-10 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                    placeholder="••••••••"
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {mode === 'signup' && (
                  <div className="mt-2 space-y-1">
                    {[
                      { label: 'At least 8 characters', test: (pw: string) => pw.length >= 8 },
                      { label: 'One uppercase letter', test: (pw: string) => /[A-Z]/.test(pw) },
                      { label: 'One number', test: (pw: string) => /[0-9]/.test(pw) },
                      { label: 'One special character', test: (pw: string) => /[^A-Za-z0-9]/.test(pw) },
                      { label: 'No spaces', test: (pw: string) => !/\s/.test(pw) },
                    ].map((rule) => {
                      const passed = password ? rule.test(password) : false;
                      return (
                        <div key={rule.label} className="flex items-center gap-1.5 text-xs">
                          <span className={passed ? 'text-green-400' : 'text-text-muted'}>
                            {passed ? '✓' : '○'}
                          </span>
                          <span className={passed ? 'text-green-400' : 'text-text-muted'}>{rule.label}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <GlowButton
                type="submit"
                className="w-full"
                size="lg"
                disabled={step === 'loading'}
              >
                {step === 'loading' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : mode === 'signin' ? (
                  'Sign In'
                ) : (
                  'Create Account'
                )}
              </GlowButton>
            </form>

            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleMagicLink}
                disabled={step === 'loading'}
                className="text-xs text-teal-400 hover:underline disabled:opacity-50"
              >
                Send magic link instead
              </button>
            </div>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-teal-500/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-navy-700/60 px-2 text-text-muted">or continue with</span>
              </div>
            </div>

            <button
              onClick={handleGoogleSignIn}
              disabled={step === 'loading'}
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-teal-500/10 bg-navy-800 py-2.5 text-sm text-text-secondary transition-colors hover:border-teal-500/30 hover:text-white disabled:opacity-50"
            >
              {step === 'loading' ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Chrome className="h-5 w-5" />
              )}
              Google
            </button>

            <p className="mt-6 text-center text-sm text-text-muted">
              {mode === 'signin' ? (
                <>Don&apos;t have an account?{' '}
                  <button onClick={() => { setMode('signup'); setError(null); setPasswordErrors([]); }} className="text-teal-400 hover:underline">
                    Sign up
                  </button>
                </>
              ) : (
                <>Already have an account?{' '}
                  <button onClick={() => { setMode('signin'); setError(null); setPasswordErrors([]); }} className="text-teal-400 hover:underline">
                    Sign in
                  </button>
                </>
              )}
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.2}>
          <p className="mt-8 text-center text-xs text-text-muted">
            By continuing, you agree to our{' '}
            <Link href="/terms" className="text-teal-400 hover:underline">Terms of Service</Link> and{' '}
            <Link href="/privacy" className="text-teal-400 hover:underline">Privacy Policy</Link>.
          </p>
        </RevealOnScroll>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center pt-24">
        <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
