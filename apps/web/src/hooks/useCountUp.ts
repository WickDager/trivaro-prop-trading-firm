'use client';

import { useState, useEffect, useRef } from 'react';

export function useCountUp(
  end: number,
  { duration = 2000, start = 0, enabled = true } = {},
) {
  // Seed with the FINAL value when animation is not (yet) enabled, so the
  // server-rendered HTML and no-JS/crawler views show "500+" rather than "0+".
  // The counter animates from `start` once `enabled` flips true.
  const [count, setCount] = useState(() => (enabled ? start : end));
  const frameRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    // Guard against NaN/Infinity reaching the DOM via CountUp.
    if (!Number.isFinite(end) || !Number.isFinite(start)) {
      setCount(Number.isFinite(end) ? end : 0);
      return;
    }

    const startTime = performance.now();
    const range = end - start;

    function animate(currentTime: number) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(start + range * eased);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      }
    }

    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, [end, duration, start, enabled]);

  return Math.round(count);
}
