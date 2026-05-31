'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { useSupabase } from '@/hooks/useSupabase';
import { cn } from '@/lib/utils';
import {
  Menu,
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Settings,
  HelpCircle,
  Shield,
  LogOut,
} from 'lucide-react';

const marketingLinks = [
  { href: '/how-it-works', label: 'How It Works', icon: HelpCircle },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const dashboardLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/challenges', label: 'Challenges', icon: TrendingUp },
  { href: '/payments', label: 'Payments', icon: Wallet },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/support', label: 'Support', icon: HelpCircle },
];

interface MobileNavProps {
  variant?: 'marketing' | 'dashboard';
}

export function MobileNav({ variant = 'marketing' }: MobileNavProps) {
  const pathname = usePathname();
  const { signOut } = useSupabase();

  const links = variant === 'dashboard' ? dashboardLinks : marketingLinks;

  return (
    <Sheet>
      <SheetTrigger>
        <Button variant="ghost" size="icon" className={variant === 'dashboard' ? 'lg:hidden' : 'md:hidden'}>
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <nav className="flex flex-col gap-2">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors',
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
          {variant === 'dashboard' && (
            <>
              <Link
                href="/admin"
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors',
                  pathname.startsWith('/admin')
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-text-secondary hover:bg-navy-700 hover:text-white',
                )}
              >
                <Shield className="h-4 w-4" />
                Admin
              </Link>
              <hr className="my-2 border-teal-500/10" />
              <button
                onClick={() => signOut()}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm text-text-muted transition-colors hover:bg-navy-700 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </>
          )}
          {variant === 'marketing' && (
            <Link href="/challenges">
              <Button variant="glow" className="mt-3 w-full">
                Start Challenge
              </Button>
            </Link>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
