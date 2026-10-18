'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSupabase } from '@/hooks/useSupabase';
import { buttonVariants } from '@/components/ui/button';
import { Logo } from '@/components/shared/Logo';
import { MobileNav } from '@/components/layout/MobileNav';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { User } from '@supabase/supabase-js';

const navLinks = [
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/rules', label: 'Rules' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/challenges', label: 'Challenges' },
];

export function Navbar() {
  const { supabase, signOut } = useSupabase();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: listener } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null);
    });

    const handleScroll = () => setScrolled(window.scrollY > 20);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      listener?.subscription.unsubscribe();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [supabase]);

  return (
    <header
      className={cn(
        'fixed top-0 z-40 w-full transition-colors duration-300',
        scrolled ? 'border-b border-teal-500/10 bg-navy-800/95' : 'bg-transparent',
      )}
    >
      <nav className="pt-safe mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* `min-h-11` gives the logo a 44px tap target without enlarging the
            artwork itself — the mark alone is only 32px tall on phones. */}
        <Link
          href="/"
          className="flex min-h-11 shrink-0 items-center gap-2"
          aria-label="Trivaro home"
        >
          <Logo className="h-8 sm:h-10" />
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden items-center gap-8 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-1 py-2 text-sm transition-colors',
                  pathname === link.href
                    ? 'text-teal-400'
                    : 'text-text-secondary hover:text-white',
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              {/* The `sm` size is 40px tall on phones; the header is the most-tapped
                  row on a handset, so the header buttons keep the 44px minimum. */}
              <Link
                href="/dashboard"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'min-h-11')}
              >
                Dashboard
              </Link>
              <button
                type="button"
                onClick={signOut}
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'min-h-11')}
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'min-h-11')}
              >
                Sign In
              </Link>
              <Link
                href="/challenges"
                className={cn(buttonVariants({ variant: 'glow', size: 'sm' }), 'hidden sm:inline-flex')}
              >
                Start Challenge
              </Link>
            </div>
          )}
          <div className="md:hidden">
            <MobileNav />
          </div>
        </div>
      </nav>
    </header>
  );
}
