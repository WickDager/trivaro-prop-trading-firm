'use client';

import { MotionConfig } from 'framer-motion';

/**
 * Honours the OS "reduce motion" setting for every Framer Motion animation in
 * the app. The CSS `prefers-reduced-motion` block in globals.css cannot affect
 * JS-driven animations, so without this wrapper the parallax/reveal/sheet
 * transitions keep running for users who explicitly asked for less motion.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
