'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/shared/Logo';
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Settings,
  HelpCircle,
  Shield,
  LogOut,
} from 'lucide-react';
import { useSupabase } from '@/hooks/useSupabase';
import { createBrowserClient } from '@/lib/supabase';
import { Button } from '@/components/ui/button';

const sidebarLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/challenges', label: 'Challenges', icon: TrendingUp },
  { href: '/payments', label: 'Payments', icon: Wallet },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
  { href: '/dashboard/support', label: 'Support', icon: HelpCircle },
];

export function Sidebar() {
  const pathname = usePathname();
  const { signOut } = useSupabase();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const supabase = createBrowserClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;
      const { data: profile } = await (supabase.from('profiles') as any)
        .select('role')
        .eq('id', user.id)
        .single();
      setIsAdmin((profile as { role: string } | null)?.role === 'admin');
    });
  }, []);

  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col gap-y-5 border-r border-teal-500/10 bg-navy-900/50 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 pt-2">
          <Logo className="h-7" />
        </Link>
        <nav className="flex flex-1 flex-col">
          <ul className="flex flex-1 flex-col gap-y-2">
            {sidebarLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-teal-500/10 text-teal-400'
                        : 'text-text-secondary hover:bg-navy-700 hover:text-white',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
            {isAdmin && (
              <li>
                <Link
                  href="/admin"
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    pathname.startsWith('/admin')
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'text-text-secondary hover:bg-navy-700 hover:text-white',
                  )}
                >
                  <Shield className="h-4 w-4" />
                  <span className="flex items-center gap-2">
                    Admin
                    <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-400">Staff</span>
                  </span>
                </Link>
              </li>
            )}
          </ul>
          <div className="mt-auto pb-4">
            <Button variant="ghost" size="sm" className="w-full justify-start text-text-muted" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </div>
        </nav>
      </div>
    </aside>
  );
}
