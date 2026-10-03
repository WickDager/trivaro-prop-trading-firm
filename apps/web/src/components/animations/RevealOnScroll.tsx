'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { useHydrated } from '@/hooks/useHydrated';

interface RevealOnScrollProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: 'up' | 'down' | 'left' | 'right';
}

const directionVariants = {
  up: { y: 40 },
  down: { y: -40 },
  left: { x: 40 },
  right: { x: -40 },
};

export function RevealOnScroll({
  children,
  className,
  delay = 0,
  direction = 'up',
}: RevealOnScrollProps) {
  // `initial={{ opacity: 0 }}` is serialised into the server-rendered HTML, so
  // without JS (or before hydration) the whole marketing site rendered as a
  // blank dark page — 25 elements, including the <h1>. Render fully visible
  // until hydration, then hand over to the animation.
  const hydrated = useHydrated();

  if (!hydrated) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, ...directionVariants[direction] }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ duration: 0.6, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
