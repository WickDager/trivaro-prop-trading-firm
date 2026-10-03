'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button, buttonVariants } from '@/components/ui/button';
import { useSupabase } from '@/hooks/useSupabase';
import { cn } from '@/lib/utils';
import {
  Menu,
  LayoutDashboard,
  TrendingUp,
  Wallet,
  HelpCircle,
  DollarSign,
  Info,
  Shield,
  LogOut,
} from 'lucide-react';

const marketingLinks = [
  { href: '/how-it-works', label: 'How It Works', icon: HelpCircle },
  { href: '/pricing', label: 'Pricing', icon: DollarSign },
  { href: '/challenges', label: 'Challenges', icon: TrendingUp },
  { href: '/about', label: 'About', icon: Info },
];

const dashboardLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/payments', label: 'Payments', icon: Wallet },
];

/** `/challenge/<id>` should still highlight nothing else, but `/dashboard/...`
 *  must keep `/dashboard` active — a bare equality check missed both. */
function isLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface MobileNavProps {
  variant?: 'marketing' | 'dashboard';
  isAdmin?: boolean;
}

export function MobileNav({ variant = 'marketing', isAdmin = false }: MobileNavProps) {
  const pathname = usePathname();
  const { signOut } = useSupabase();
  const [open, setOpen] = useState(false);

  // The layout stays mounted across client-side navigations, so an open menu
  // would otherwise stay on screen (and keep the body scroll-locked) after the
  // user taps a link.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const links = variant === 'dashboard' ? dashboardLinks : marketingLinks;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation menu"
          className={cn('h-11 w-11', variant === 'dashboard' ? 'lg:hidden' : 'md:hidden')}
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" aria-label="Navigation menu">
        <nav className="flex flex-col gap-2 pt-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = isLinkActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors active:bg-navy-600',
                  isActive
                    ? 'bg-teal-500/10 text-teal-400'
                    : 'text-text-secondary hover:bg-navy-700 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          {variant === 'dashboard' && isAdmin && (
            <Link
              href="/admin"
              className={cn(
                'flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors active:bg-navy-600',
                pathname.startsWith('/admin')
                  ? 'bg-amber-500/10 text-amber-400'
                  : 'text-text-secondary hover:bg-navy-700 hover:text-white',
              )}
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
          {variant === 'dashboard' && (
            <>
              <hr className="my-2 border-teal-500/10" />
              <button
                type="button"
                onClick={() => signOut()}
                className="flex min-h-11 items-center gap-3 rounded-lg px-4 py-3 text-sm text-text-muted transition-colors hover:bg-navy-700 hover:text-white active:bg-navy-600"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </>
          )}
          {variant === 'marketing' && (
            <Link
              href="/challenges"
              className={cn(buttonVariants({ variant: 'glow' }), 'mt-3 w-full')}
            >
              Start Challenge
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
