'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { createBrowserClient } from '@/lib/supabase';
import { Logo } from '@/components/shared/Logo';
import {
  LayoutDashboard, Users, ShoppingCart, TrendingUp,
  Shield, LogOut, ChevronLeft, Menu,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

const adminLinks = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/admin/challenges', label: 'Challenges', icon: TrendingUp },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-navy-900">
      <div className="fixed top-0 z-50 flex h-12 w-full items-center justify-between border-b border-amber-500/20 bg-navy-800/90 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="flex items-center gap-2">
            <Logo className="h-8" />
          </Link>
          <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400 uppercase tracking-wider">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="lg:hidden">
            <Sheet>
              <SheetTrigger>
                <Button variant="ghost" size="icon">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom">
                <nav className="flex flex-col gap-2 pt-4">
                  {adminLinks.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm transition-colors ${
                          isActive
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'text-text-secondary hover:bg-navy-700 hover:text-white'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        <Link
          href="/dashboard"
          className="flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary"
        >
          <ChevronLeft className="h-3 w-3" />
          Back to App
        </Link>
      </div>
      </div>

      <aside className="fixed left-0 top-12 hidden h-[calc(100vh-3rem)] w-56 flex-col border-r border-amber-500/10 bg-navy-800/30 lg:flex">
        <nav className="flex flex-1 flex-col gap-1 p-3">
          {adminLinks.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-amber-500/10 text-amber-400'
                    : 'text-text-secondary hover:bg-navy-700 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-amber-500/10 p-3">
          <button
            onClick={async () => {
              const supabase = createBrowserClient();
              await supabase.auth.signOut();
              router.push('/login');
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-navy-700 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <main className="pt-12 lg:pl-56">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 h-0.5 w-full rounded-full bg-gradient-to-r from-amber-500/0 via-amber-500/50 to-amber-500/0" />
          {children}
        </div>
      </main>
    </div>
  );
}
