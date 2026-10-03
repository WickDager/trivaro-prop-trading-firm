export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { GridPattern } from '@/components/animations/GridPattern';
import { EmailVerificationBanner } from '@/components/dashboard/EmailVerificationBanner';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?redirect=/dashboard');

  // Resolved on the server so the admin link is never rendered to a
  // non-admin, even for a moment, and no extra client round-trip is needed.
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = (profile as { role: string } | null)?.role === 'admin';

  return (
    <ErrorBoundary>
      <div className="min-h-dvh">
        <GridPattern />
        <Sidebar isAdmin={isAdmin} />
        <div className="pt-safe fixed left-0 right-0 top-0 z-30 flex min-h-14 items-center justify-between border-b border-teal-500/10 bg-navy-900/95 px-4 lg:hidden">
          <span className="text-sm font-semibold text-text-secondary">Trivaro</span>
          <MobileNav variant="dashboard" isAdmin={isAdmin} />
        </div>
        <main id="main" className="pt-[calc(3.5rem+env(safe-area-inset-top,0px))] lg:pl-64 lg:pt-0">
          <EmailVerificationBanner />
          <div className="mx-auto max-w-5xl px-4 py-8 pb-safe sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
