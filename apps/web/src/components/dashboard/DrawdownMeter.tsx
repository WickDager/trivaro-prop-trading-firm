'use client';

interface DrawdownMeterProps {
  current: number;
  max: number;
  label?: string;
}

export function DrawdownMeter({ current, max, label = 'Drawdown' }: DrawdownMeterProps) {
  // `max` comes straight from the DB. A 0/null max produced Infinity (ring
  // pinned full-red) and a NaN produced strokeDashoffset="NaN" (ring vanished).
  const safeCurrent = Number.isFinite(current) ? current : 0;
  const percentage =
    Number.isFinite(max) && max > 0
      ? Math.min(Math.max((safeCurrent / max) * 100, 0), 100)
      : 0;
  const isWarning = percentage > 70;
  const isDanger = percentage > 90;

  const strokeColor = isDanger ? '#EF4444' : isWarning ? '#F59E0B' : '#00D9FF';

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-full max-w-[140px]">
        <svg
          viewBox="0 0 140 140"
          className="w-full"
          role="img"
          aria-label={`${label}: ${safeCurrent.toFixed(1)}% of ${max}% limit`}
        >
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke="rgba(0,217,255,0.1)"
            strokeWidth="8"
          />
          <circle
            cx="70"
            cy="70"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-xl font-bold">{current.toFixed(1)}%</span>
          <span className="text-xs text-text-muted">{label}</span>
        </div>
      </div>
    </div>
  );
}
