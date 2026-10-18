'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useSupabase } from '@/hooks/useSupabase';
import { Logo } from '@/components/shared/Logo';
import {
  LayoutDashboard, Users, BadgeCheck, TrendingUp, LineChart, KeyRound,
  CreditCard, Award, History, Settings, LogOut, Menu, ChevronLeft,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

type BadgeKey = 'verify' | 'provision' | 'orders';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: BadgeKey;
}

/**
 * The admin surface, grouped by the job being done rather than by table name:
 * people (who is trading), accounts (what they are trading), money (what they
 * paid) and system. Nav text is short so the sidebar never needs horizontal
 * scrolling at 240px.
 */
const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ href: '/admin', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'People',
    items: [
      { href: '/admin/traders', label: 'Traders', icon: Users },
      { href: '/admin/verify', label: 'Verification', icon: BadgeCheck, badge: 'verify' },
    ],
  },
  {
    label: 'Accounts',
    items: [
      { href: '/admin/challenges', label: 'Challenges', icon: TrendingUp },
      { href: '/admin/trades', label: 'Trades', icon: LineChart },
      { href: '/admin/provision', label: 'Provisioning', icon: KeyRound, badge: 'provision' },
    ],
  },
  {
    label: 'Money',
    items: [
      { href: '/admin/orders', label: 'Payments', icon: CreditCard, badge: 'orders' },
      { href: '/admin/certificates', label: 'Certificates', icon: Award },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/admin/activity', label: 'Activity', icon: History },
      { href: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function isLinkActive(pathname: string, href: string) {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}

// Shared height tokens so the fixed header, the fixed sidebar and the main
// padding can never disagree — when they did, the sidebar sat under the header.
const HEADER_H = 'min-h-12';
const HEADER_OFFSET = 'calc(3rem + env(safe-area-inset-top, 0px))';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { supabase, signOut } = useSupabase();
  const [menuOpen, setMenuOpen] = useState(false);
  const [counts, setCounts] = useState<Partial<Record<BadgeKey, number>>>({});

  // The layout stays mounted across navigations, so an open drawer must be
  // closed explicitly or it covers the page the user just navigated to.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Small, cheap head-count queries that back the nav badges ("what needs me
  // right now?"). Re-run on navigation so acting on a queue clears its badge.
  const loadCounts = useCallback(async () => {
    const [kyc, provisioning, orders] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
      supabase.from('challenges').select('id', { count: 'exact', head: true }).in('credential_status', ['pending', 'provisioned']),
      supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setCounts({
      verify: kyc.count ?? 0,
      provision: provisioning.count ?? 0,
      orders: orders.count ?? 0,
    });
  }, [supabase]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts, pathname]);

  function renderNav(onNavigate?: () => void) {
    return (
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto p-3" aria-label="Admin sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted/80">
              {group.label}
            </p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = isLinkActive(pathname, item.href);
                const badge = item.badge ? counts[item.badge] : undefined;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-amber-500/10 text-amber-400'
                          : 'text-text-secondary hover:bg-navy-700 hover:text-white',
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {badge !== undefined && badge > 0 && (
                        <span
                          className={cn(
                            'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                            isActive ? 'bg-amber-500/20 text-amber-300' : 'bg-navy-600 text-text-secondary',
                          )}
                        >
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        <button
          type="button"
          onClick={signOut}
          className="mt-auto flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-navy-700 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </nav>
    );
  }

  return (
    <div className="min-h-dvh bg-navy-900">
      <header
        className={cn(
          HEADER_H,
          'pt-safe fixed inset-x-0 top-0 z-40 flex items-center gap-2 border-b border-amber-500/20 bg-navy-800/95 px-3 backdrop-blur sm:px-4',
        )}
      >
        <div className="lg:hidden">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger>
              <Button variant="ghost" size="icon" aria-label="Open admin navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" aria-label="Admin navigation" className="w-72 max-w-[85vw] p-0">
              <p className="px-5 pb-2 pt-5 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                Admin
              </p>
              {renderNav(() => setMenuOpen(false))}
            </SheetContent>
          </Sheet>
        </div>

        <Link href="/admin" className="flex min-w-0 items-center gap-2">
          <Logo className="h-7 shrink-0" />
          <span className="hidden truncate font-heading text-sm font-semibold sm:inline">Trivaro</span>
        </Link>
        {/* Hidden on the narrowest screens: with the menu button, logo and the
            "Back to app" link on one 48px row, this badge is what pushed the
            header into two overlapping lines. */}
        <span className="hidden shrink-0 rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-amber-400 sm:inline">
          Admin
        </span>

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Link
            href="/dashboard"
            className="flex min-h-10 items-center gap-1 whitespace-nowrap rounded-lg px-2 text-xs text-text-muted transition-colors hover:text-white sm:px-3"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Back to app</span>
            <span className="sm:hidden">App</span>
          </Link>
        </div>
      </header>

      <aside
        className="fixed left-0 z-30 hidden w-60 flex-col border-r border-amber-500/10 bg-navy-800/30 lg:flex"
        style={{ top: HEADER_OFFSET, height: `calc(100dvh - ${HEADER_OFFSET})` }}
      >
        {renderNav()}
      </aside>

      <main
        id="main"
        className="lg:pl-60"
        style={{ paddingTop: HEADER_OFFSET }}
      >
        <div className="mx-auto max-w-[1400px] px-3 py-5 pb-safe sm:px-5 lg:px-6">
          <div className="mb-5 h-0.5 w-full rounded-full bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0" />
          {children}
        </div>
      </main>
    </div>
  );
}
