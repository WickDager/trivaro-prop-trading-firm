'use client';

import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { Star } from 'lucide-react';

const testimonials = [
  {
    name: 'Alex M.',
    handle: '@alex_trader',
    text: 'Passed the $50K challenge in 12 days. The rules are clear and achievable. Got funded within 24 hours.',
    rating: 5,
  },
  {
    name: 'Sarah K.',
    handle: '@sarah_forex',
    text: 'Best prop firm I have worked with. Crypto payment was instant and the Telegram bot made it super easy.',
    rating: 5,
  },
  {
    name: 'Marcus J.',
    handle: '@marcus_swing',
    text: 'After failing with 3 other firms, Trivaro\'s realistic targets helped me finally get funded. Game changer.',
    rating: 5,
  },
  {
    name: 'Elena V.',
    handle: '@elena_trades',
    text: 'The drawdown rules actually make sense. Real trading conditions, not gambling. Highly recommend.',
    rating: 5,
  },
];

export function Testimonials() {
  const doubled = [...testimonials, ...testimonials];

  return (
    <section className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <RevealOnScroll>
          <div className="mb-16 text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Trusted by <span className="gradient-text">Traders</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Join hundreds of successful funded traders
            </p>
          </div>
        </RevealOnScroll>

        <div className="overflow-hidden">
          <div className="flex animate-ticker gap-6">
            {doubled.map((t, i) => (
              <div
                key={i}
                className="w-[280px] shrink-0 rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 sm:w-80"
              >
                <div className="mb-3 flex gap-1">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="mb-4 text-sm text-text-secondary">{t.text}</p>
                <div>
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-text-muted">{t.handle}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
