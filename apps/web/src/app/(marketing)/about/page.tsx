'use client';

import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';
import { Shield, TrendingUp, Users, Globe } from 'lucide-react';

const values = [
  {
    icon: Shield,
    title: 'Trust First',
    description: 'We believe in transparent rules, fair evaluations, and timely payouts. No hidden terms.',
  },
  {
    icon: TrendingUp,
    title: 'Trader Success',
    description: 'Our challenges are designed to identify skilled traders, not to trick you. Achievable targets.',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Join a growing community of funded traders who support and learn from each other.',
  },
  {
    icon: Globe,
    title: 'Global Access',
    description: 'Accessible to traders worldwide with crypto payment options and 24/7 support.',
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">
              About <GradientText as="span">Trivaro</GradientText>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-text-secondary">
              We are on a mission to discover and fund the next generation of talented traders.
            </p>
          </div>
        </RevealOnScroll>

        <RevealOnScroll delay={0.1}>
          <div className="mt-16 rounded-xl border border-teal-500/10 bg-navy-700/60 p-8">
            <h2 className="mb-4 font-heading text-2xl font-bold">Our Story</h2>
            <p className="text-text-secondary leading-relaxed">
              Trivaro was founded by a team of experienced traders and technologists who saw a broken model
              in the prop trading industry. High fees, impossible targets, and slow payouts were the norm.
              We built Trivaro to be different: lower fees, realistic targets, instant crypto payouts,
              and full transparency. Our zero-infrastructure approach lets us pass massive savings
              on to our traders.
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {values.map((value, i) => {
            const Icon = value.icon;
            return (
              <RevealOnScroll key={value.title} delay={i * 0.1}>
                <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mb-2 font-heading text-lg font-semibold">{value.title}</h3>
                  <p className="text-sm text-text-secondary">{value.description}</p>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>
      </div>
    </div>
  );
}
