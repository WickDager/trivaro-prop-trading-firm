'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';

export function Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center px-4 pt-16">
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="font-heading text-3xl font-bold break-words leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
        >
          From Demo to{' '}
          <GradientText as="span">Funded</GradientText>
          <br />
          Your Trading Career Starts Here
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="mx-auto mt-6 max-w-2xl px-4 text-base text-text-secondary sm:text-lg"
        >
          Prove your skills in a simulated environment. Pass our challenge, get funded with real capital,
          and keep up to 90% of the profits. No strings attached.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <Link href="/challenges">
            <GlowButton size="xl">Start Your Challenge</GlowButton>
          </Link>
          <Link href="/how-it-works">
            <button className="rounded-xl border border-white/40 bg-white/5 px-8 py-3.5 text-sm font-medium text-white transition-all hover:bg-white/10 hover:border-white/60">
              How It Works
            </button>
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.6 }}
          className="mt-16"
        >
          <img
            src="/brand/trivaro-logo-animated.svg"
            alt="Trivaro"
            className="mx-auto h-16 opacity-40"
          />
        </motion.div>
      </div>
    </section>
  );
}
