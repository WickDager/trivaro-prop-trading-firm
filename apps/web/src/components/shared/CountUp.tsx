'use client';

import { useCountUp } from '@/hooks/useCountUp';

interface CountUpProps {
  end: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  enabled?: boolean;
  className?: string;
}

export function CountUp({ end, duration, prefix = '', suffix = '', enabled = true, className }: CountUpProps) {
  const count = useCountUp(end, { duration, enabled });

  return (
    <span className={className}>
      {prefix}{count}{suffix}
    </span>
  );
}
