'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';
import { CHALLENGE_PRICING } from '@/lib/constants';
import { Check } from 'lucide-react';

export function ChallengeCards() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <RevealOnScroll>
          <div className="text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Choose Your <GradientText as="span">Challenge</GradientText>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Pick the account size that matches your trading style
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {CHALLENGE_PRICING.map((challenge, i) => (
            <RevealOnScroll key={challenge.accountSize} delay={i * 0.05}>
              <motion.div
                whileHover={{ rotateX: 5, rotateY: -5 }}
                style={{ perspective: '1000px' }}
                className="group relative flex flex-col rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 transition-all hover:border-teal-500/30"
              >
                <div className="mb-4">
                  <p className="text-sm text-text-muted">Account Size</p>
                  <p className="font-heading text-3xl font-bold">
                    ${(challenge.accountSize / 1000).toFixed(0)}K
                  </p>
                </div>

                <div className="mb-6 space-y-2">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-green-400" />
                    <span>{challenge.profitTarget}% Profit Target</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-green-400" />
                    <span>{challenge.maxDrawdown}% Max Drawdown</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <Check className="h-4 w-4 text-green-400" />
                    <span>{challenge.minTradingDays} Min Days</span>
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-sm text-text-muted">From</p>
                  <p className="font-heading text-2xl font-bold text-green-400">
                    ${challenge.equityChallenge}
                  </p>
                </div>

                <div className="mt-auto">
                  <Link href={`/challenges?size=${challenge.accountSize}`}>
                    <GlowButton className="w-full text-xs" size="sm">
                      Select Account
                    </GlowButton>
                  </Link>
                </div>
              </motion.div>
            </RevealOnScroll>
          ))}
        </div>
      </div>
    </section>
  );
}
