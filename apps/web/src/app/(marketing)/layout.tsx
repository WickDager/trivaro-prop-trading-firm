import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { AuroraBackground } from '@/components/animations/AuroraBackground';
import { ParticleField } from '@/components/animations/ParticleField';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuroraBackground />
      <ParticleField />
      <Navbar />
      <main>{children}</main>
      <Footer />
    </>
  );
}
