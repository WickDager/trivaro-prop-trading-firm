'use client';

import { motion } from 'framer-motion';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';
import { Shield, Zap, TrendingUp, Wallet, Globe, HeadphonesIcon } from 'lucide-react';

const features = [
  {
    icon: Shield,
    title: 'Capital Protection',
    description: 'Trade with our capital. You risk nothing but the challenge fee. Keep up to 90% of profits.',
  },
  {
    icon: Zap,
    title: 'Instant Funding',
    description: 'Pass the challenge and get funded within 24 hours. Start trading with real capital immediately.',
  },
  {
    icon: TrendingUp,
    title: 'Realistic Targets',
    description: 'Achievable 8% profit target with 5% max drawdown. Designed for real-world trading success.',
  },
  {
    icon: Wallet,
    title: 'Crypto Payments',
    description: 'Pay with USDT, USDC, or BTC. Fast, secure, and borderless transactions via Telegram.',
  },
  {
    icon: Globe,
    title: 'Global Access',
    description: 'Trade from anywhere in the world. No geographical restrictions or banking limitations.',
  },
  {
    icon: HeadphonesIcon,
    title: '24/7 Support',
    description: 'Get instant support via Telegram. Our team is always available to help you succeed.',
  },
];

export function Features() {
  return (
    <section className="relative px-4 py-24 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <RevealOnScroll>
          <div className="text-center">
            <h2 className="font-heading text-3xl font-bold sm:text-4xl">
              Why Choose <GradientText as="span">Trivaro</GradientText>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              We provide everything you need to succeed as a funded trader
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <RevealOnScroll key={feature.title} delay={i * 0.1}>
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  className="group rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 transition-all hover:border-teal-500/30"
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 font-heading text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm text-text-secondary">{feature.description}</p>
                </motion.div>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </section>
  );
}
