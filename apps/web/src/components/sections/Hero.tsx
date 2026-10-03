'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { buttonVariants } from '@/components/ui/button';
import { GradientText } from '@/components/shared/GradientText';
import { useHydrated } from '@/hooks/useHydrated';
import { cn } from '@/lib/utils';

export function Hero() {
  // The entrance animations set `opacity: 0` in the SSR'd HTML, which made the
  // entire hero — including the <h1> and the primary CTA — invisible until JS
  // loaded. Render it visible, then animate in once hydrated.
  const hydrated = useHydrated();

  const fade = (delay: number) =>
    hydrated
      ? {
          initial: { opacity: 0, y: 30 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.8, delay },
        }
      : {};

  return (
    <section className="relative flex min-h-dvh items-center justify-center px-4 pb-16 pt-24">
      <div className="relative z-10 mx-auto max-w-5xl text-center">
        <motion.h1
          {...fade(0.1)}
          className="font-heading text-[1.75rem] font-bold leading-tight tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
        >
          From Demo to <GradientText as="span">Funded</GradientText>
          <span className="block">Your Trading Career Starts Here</span>
        </motion.h1>

        <motion.p
          {...fade(0.2)}
          className="mx-auto mt-6 max-w-2xl text-base text-text-secondary sm:text-lg"
        >
          Prove your skills in a simulated environment. Pass our challenge, get funded with real capital,
          and keep up to 90% of the profits. No strings attached.
        </motion.p>

        <motion.div
          {...fade(0.3)}
          className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          {/* The styled element IS the link. Wrapping a <button> in an <a> is
              invalid HTML and gives keyboard users two tab stops per CTA. */}
          <Link
            href="/challenges"
            className={cn(buttonVariants({ variant: 'glow', size: 'xl' }), 'w-full sm:w-auto')}
          >
            Start Your Challenge
          </Link>
          <Link
            href="/how-it-works"
            className={cn(buttonVariants({ variant: 'outline', size: 'xl' }), 'w-full sm:w-auto')}
          >
            How It Works
          </Link>
        </motion.div>

        <motion.div
          {...(hydrated
            ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 1, delay: 0.6 } }
            : {})}
          className="mt-12"
        >
          <img
            src="/brand/trivaro-logo-animated.svg"
            alt=""
            aria-hidden="true"
            width={400}
            height={64}
            className="mx-auto h-16 w-auto opacity-40"
          />
        </motion.div>
      </div>
    </section>
  );
}
