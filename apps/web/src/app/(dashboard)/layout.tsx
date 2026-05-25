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
      <MobileNav />
      <main className="lg:pl-64">
        <EmailVerificationBanner />
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
