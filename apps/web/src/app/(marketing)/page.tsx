import type { Metadata } from 'next';
import { Hero } from '@/components/sections/Hero';
import { LiveTicker } from '@/components/sections/LiveTicker';
import { Features } from '@/components/sections/Features';
import { Stats } from '@/components/sections/Stats';
import { Pricing } from '@/components/sections/Pricing';
import { Testimonials } from '@/components/sections/Testimonials';
import { CTA } from '@/components/sections/CTA';

// Title and description come from the root layout's site-wide defaults; the
// homepage only needs to declare its own canonical URL.
export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

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
