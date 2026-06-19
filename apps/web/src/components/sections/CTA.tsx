'use client';

import Link from 'next/link';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';

export function CTA() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-2xl border border-teal-500/10 bg-gradient-to-br from-navy-700 to-navy-800 p-8 text-center sm:p-12 lg:p-16">
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-teal-500/10 blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-green-500/10 blur-[80px]" />

            <div className="relative z-10">
              <h2 className="font-heading text-3xl font-bold sm:text-4xl">
                Ready to Become a{' '}
                <GradientText as="span">Funded Trader</GradientText>?
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-text-secondary">
                Join Trivaro today and take the first step toward trading with real capital.
                No risk, no monthly fees, just results.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/challenges">
                  <GlowButton size="xl">Start Your Journey</GlowButton>
                </Link>
                <Link href="/how-it-works">
                  <button className="rounded-xl border border-white/40 bg-white/5 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/60">
                    Learn More
                  </button>
                </Link>
              </div>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </section>
  );
}
