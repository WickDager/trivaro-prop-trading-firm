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

  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <GridPattern />
        <Sidebar />
        <div className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-teal-500/10 bg-navy-900/80 px-4 backdrop-blur-xl lg:hidden">
          <span className="text-sm font-semibold text-text-secondary">Trivaro</span>
          <MobileNav variant="dashboard" />
        </div>
        <main className="pt-14 lg:pl-64 lg:pt-0">
          <EmailVerificationBanner />
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
