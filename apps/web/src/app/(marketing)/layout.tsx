import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AuroraBackground } from '@/components/animations/AuroraBackground';
import { ParticleField } from '@/components/animations/ParticleField';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <AuroraBackground />
      <ParticleField />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </ErrorBoundary>
  );
}
