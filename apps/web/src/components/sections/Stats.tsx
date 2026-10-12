'use client';

import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { CountUp } from '@/components/shared/CountUp';
import { useInView } from 'framer-motion';
import { useRef } from 'react';

// These headline figures are illustrative marketing. The two that describe the
// product were harmonised with the published rules so the homepage can never
// promise more than the rulebook allows: the profit split tops out at 90%
// (rules page), and verification/funding is stated as within 24 hours
// (how-it-works and Features), not 48.
const stats = [
  { value: 500, suffix: '+', label: 'Active Traders' },
  { value: 5, prefix: '$', suffix: 'M+', label: 'Capital Deployed' },
  { value: 90, suffix: '%', label: 'Max Profit Split' },
  { value: 24, suffix: 'hr', label: 'Avg Payout Time' },
];

export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true });

  return (
    <section ref={ref} className="relative border-y border-teal-500/10 px-4 py-20 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {stats.map((stat, i) => (
            <RevealOnScroll key={stat.label} delay={i * 0.1}>
              <div className="text-center">
                <p className="font-heading text-3xl font-bold text-teal-400 sm:text-4xl md:text-5xl">
                  <CountUp
                    end={stat.value}
                    prefix={stat.prefix ?? ''}
                    suffix={stat.suffix}
                    enabled={inView}
                  />
                </p>
                <p className="mt-2 text-sm text-text-secondary">{stat.label}</p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
