'use client';

import Link from 'next/link';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';
import { Wallet, TrendingUp, DollarSign, Trophy } from 'lucide-react';

const steps = [
  {
    icon: Wallet,
    title: '1. Choose & Pay',
    description:
      'Select your challenge account size ($5K-$100K) and pay the one-time fee using USDT, USDC, or BTC via our Telegram bot.',
  },
  {
    icon: TrendingUp,
    title: '2. Trade the Challenge',
    description:
      'Trade in simulated conditions with real market data. Hit the 8% profit target while staying within the 5% max drawdown limit.',
  },
  {
    icon: DollarSign,
    title: '3. Get Verified',
    description:
      'Complete Phase 1 and Phase 2 with consistent trading. Our system automatically verifies your results within 24 hours.',
  },
  {
    icon: Trophy,
    title: '4. Get Funded',
    description:
      'Receive your funded account with real capital. Keep up to 90% of all profits. No monthly fees, no minimum trading days.',
  },
];

const rules = [
  { label: 'Profit Target', value: '8% (each phase)' },
  { label: 'Max Daily Drawdown', value: '3%' },
  { label: 'Max Total Drawdown', value: '5%' },
  { label: 'Minimum Trading Days', value: '5' },
  { label: 'Profit Split', value: 'Up to 90%' },
  { label: 'Refundable', value: 'Yes (Phase 1)' },
];

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">
              How It <GradientText as="span">Works</GradientText>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Four simple steps to becoming a funded trader with Trivaro
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-20 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <RevealOnScroll key={step.title} delay={i * 0.15}>
                <div className="relative rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/10 text-teal-400">
                    <Icon className="h-8 w-8" />
                  </div>
                  <h3 className="mb-2 font-heading text-lg font-semibold">{step.title}</h3>
                  <p className="text-sm text-text-secondary">{step.description}</p>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>

        <RevealOnScroll delay={0.2}>
          <div className="mt-20">
            <h2 className="mb-8 text-center font-heading text-2xl font-bold">
              Challenge <GradientText as="span">Rules</GradientText>
            </h2>
            <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border border-teal-500/10">
              {rules.map((rule, i) => (
                <div
                  key={rule.label}
                  className={`flex items-center justify-between px-6 py-4 ${
                    i % 2 === 0 ? 'bg-navy-700/60' : 'bg-navy-800'
                  }`}
                >
                  <span className="text-sm text-text-secondary">{rule.label}</span>
                  <span className="text-sm font-semibold">{rule.value}</span>
                </div>
              ))}
            </div>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.3}>
          <div className="mt-16 text-center">
            <Link href="/challenges">
              <GlowButton size="xl">Start Your Challenge</GlowButton>
            </Link>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
