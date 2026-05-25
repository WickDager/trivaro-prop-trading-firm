'use client';

import Link from 'next/link';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';
import { CHALLENGE_PRICING } from '@/lib/constants';
import { Check } from 'lucide-react';
import { motion } from 'framer-motion';

export function Pricing() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <RevealOnScroll>
          <div className="text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Simple <GradientText as="span">Pricing</GradientText>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              One-time fee. No hidden costs. No monthly subscriptions.
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {CHALLENGE_PRICING.slice(0, 4).map((challenge, i) => (
            <RevealOnScroll key={challenge.accountSize} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -5 }}
                className="flex flex-col rounded-xl border border-teal-500/10 bg-navy-700/60 p-8 transition-all hover:border-teal-500/30"
              >
                <div className="mb-6">
                  <p className="text-sm text-text-muted">Account</p>
                  <p className="font-heading text-2xl font-bold">
                    ${(challenge.accountSize / 1000).toFixed(0)}K
                  </p>
                </div>

                <div className="mb-6">
                  <p className="text-3xl font-bold text-green-400">
                    ${challenge.equityChallenge}
                  </p>
                  <p className="text-sm text-text-muted">one-time fee</p>
                </div>

                <div className="mb-8 space-y-3">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-green-400" />
                    {challenge.profitTarget}% Profit Target
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-green-400" />
                    {challenge.maxDrawdown}% Max Drawdown
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-green-400" />
                    {challenge.minTradingDays} Min Trading Days
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-green-400" />
                    Up to 90% Profit Split
                  </div>
                </div>

                <div className="mt-auto">
                  <Link href={`/challenges?size=${challenge.accountSize}`}>
                    <GlowButton className="w-full" size="sm">
                      Get Started
                    </GlowButton>
                  </Link>
                </div>
              </motion.div>
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll delay={0.2}>
          <p className="mt-8 text-center text-sm text-text-muted">
            Pay with USDT (TRC20), USDC (Base), or BTC. Full refund if you don&apos;t pass Phase 1.
          </p>
        </RevealOnScroll>
      </div>
    </section>
  );
}
