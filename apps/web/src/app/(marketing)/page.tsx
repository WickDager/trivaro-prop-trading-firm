import { Hero } from '@/components/sections/Hero';
import { LiveTicker } from '@/components/sections/LiveTicker';
import { Features } from '@/components/sections/Features';
import { Stats } from '@/components/sections/Stats';
import { Pricing } from '@/components/sections/Pricing';
import { Testimonials } from '@/components/sections/Testimonials';
import { CTA } from '@/components/sections/CTA';

export default function HomePage() {
  return (
    <>
      <Hero />
      <LiveTicker />
      <Features />
      <Stats />
      <Pricing />
      <Testimonials />
      <CTA />
    </>
  );
}
