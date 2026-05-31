export const dynamic = 'force-dynamic';

import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { GridPattern } from '@/components/animations/GridPattern';
import { EmailVerificationBanner } from '@/components/dashboard/EmailVerificationBanner';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <GridPattern />
      <Sidebar />
      <div className="fixed left-0 right-0 top-0 z-30 flex h-14 items-center justify-between border-b border-teal-500/10 bg-navy-900/80 px-4 backdrop-blur-xl lg:hidden">
        <MobileNav variant="dashboard" />
        <span className="text-sm font-semibold text-text-secondary">Trivaro</span>
        <div className="w-10" />
      </div>
      <main className="pt-14 lg:pl-64 lg:pt-0">
        <EmailVerificationBanner />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
