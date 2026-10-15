'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { TONE_CLASS, CHIP_ACTIVE, CHIP_IDLE, type Tone } from '@/lib/admin';

/**
 * Small presentational pieces shared by every admin screen.
 *
 * Layout rule for this whole area: nothing is absolutely positioned and no
 * control is placed next to another without a flex `gap`. On a 320px phone the
 * admin tables, filter rows and action groups all wrap instead of colliding —
 * the old admin header stacked a logo, a "Staff" badge, a hamburger and a
 * "Back to App" link on one 48px row, which overlapped below ~360px.
 */

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-[11px] font-medium',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatCard({
  label,
  value,
  hint,
  tone = 'info',
  icon: Icon,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: React.ComponentType<{ className?: string }>;
  href?: string;
}) {
  const body = (
    <div className="flex h-full flex-col justify-between gap-3 rounded-xl border border-amber-500/10 bg-navy-700/60 p-4 transition-colors hover:border-amber-500/25">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-xs font-medium text-text-muted">{label}</p>
        {Icon && (
          <span className={cn('shrink-0 rounded-lg p-1.5', TONE_CLASS[tone])}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="font-heading text-xl font-bold tabular-nums sm:text-2xl">{value}</p>
        {hint && <p className="mt-1 text-[11px] leading-snug text-text-muted">{hint}</p>}
      </div>
    </div>
  );

  return href ? (
    <Link
      href={href}
      className="block h-full rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60"
    >
      {body}
    </Link>
  ) : (
    body
  );
}

export function ProgressBar({
  value,
  tone = 'info',
  label,
  caption,
}: {
  /** 0–100+ ; values above 100 fill the bar and are shown as-is. */
  value: number;
  tone?: Tone;
  label?: string;
  caption?: string;
}) {
  const safe = Number.isFinite(value) ? Math.max(0, value) : 0;
  const width = Math.min(100, safe);
  const fill: Record<Tone, string> = {
    neutral: 'bg-navy-500',
    info: 'bg-teal-500',
    success: 'bg-green-500',
    warn: 'bg-amber-500',
    danger: 'bg-red-500',
  };

  return (
    <div className="min-w-0">
      {(label || caption) && (
        <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px]">
          {label && <span className="text-text-muted">{label}</span>}
          {caption && <span className="tabular-nums text-text-secondary">{caption}</span>}
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-navy-800"
        role="progressbar"
        aria-valuenow={Math.round(safe)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className={cn('h-full rounded-full transition-[width] duration-500', fill[tone])} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  labels,
  counts,
  ariaLabel,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  labels?: Partial<Record<T, string>>;
  counts?: Partial<Record<T, number>>;
  ariaLabel: string;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option === value;
        const count = counts?.[option];
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option)}
            className={cn(
              'inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition-colors active:scale-[0.98]',
              active ? CHIP_ACTIVE : CHIP_IDLE,
            )}
          >
            <span>{labels?.[option] ?? option}</span>
            {count !== undefined && (
              <span className={cn('tabular-nums text-[10px]', active ? 'text-amber-300/80' : 'text-text-muted')}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-500/10 bg-navy-700/40 px-6 py-12 text-center">
      {Icon && <Icon className="h-8 w-8 text-text-muted" />}
      <div>
        <p className="font-heading text-sm font-semibold">{title}</p>
        {description && <p className="mx-auto mt-1 max-w-md text-xs text-text-muted">{description}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-xl border border-amber-500/10 bg-navy-700/40', className)}>
      <header className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2 border-b border-amber-500/10 px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-heading text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function DefinitionList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-[11px] uppercase tracking-wide text-text-muted">{item.label}</dt>
          <dd className="mt-0.5 truncate text-sm">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
