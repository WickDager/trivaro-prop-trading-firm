'use client';

import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import type { ChallengePricing } from '@trivaro/shared-types';

// `motion.div` is a client-only component (it calls createMotionComponent at
// access time), so the hover-animated card lives here and the page itself can
// stay a server component and export metadata.
export function ChallengeCard({ challenge }: { challenge: ChallengePricing }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="flex flex-col rounded-xl border border-teal-500/10 bg-navy-700/60 p-8 transition-all hover:border-teal-500/30"
    >
      <div className="mb-4">
        <p className="text-sm text-text-muted">Account</p>
        <p className="font-heading text-3xl font-bold">
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
        <Link
          href={`/challenges?size=${challenge.accountSize}`}
          className={cn(buttonVariants({ variant: 'glow', size: 'sm' }), 'w-full')}
        >
          Get Started
        </Link>
      </div>
    </motion.div>
  );
}
