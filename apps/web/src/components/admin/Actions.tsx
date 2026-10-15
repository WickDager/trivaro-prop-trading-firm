'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { Check, Loader2, TriangleAlert } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25',
  secondary: 'bg-navy-800 text-text-secondary hover:bg-navy-600 hover:text-white',
  success: 'bg-green-500/10 text-green-400 hover:bg-green-500/20',
  danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20',
  ghost: 'text-text-muted hover:bg-navy-700 hover:text-white',
};

const SIZES = {
  sm: 'min-h-9 px-2.5 text-[11px]',
  md: 'min-h-9 px-3 text-xs',
  lg: 'min-h-11 px-4 text-sm',
};

export function adminButtonClass(
  variant: ButtonVariant = 'secondary',
  size: keyof typeof SIZES = 'md',
  className?: string,
): string {
  return cn(
    // `shrink-0` + `whitespace-nowrap`: inside a table's action cell these
    // buttons must never be squeezed into each other.
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors',
    'disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/60',
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ActionOutcome {
  ok: boolean;
  error?: string;
  hint?: string;
}

/**
 * A button that owns its own pending/failure state.
 *
 * Admin actions here write to the database, so the button stays disabled until
 * the request settles and a failure is surfaced inline instead of swallowed —
 * the previous admin pages flipped local state optimistically and then showed
 * "success" even when the write had been rejected.
 */
export function AsyncButton({
  onRun,
  children,
  pendingLabel,
  variant = 'secondary',
  size = 'md',
  icon: Icon,
  disabled,
  disabledReason,
  title,
  className,
  successLabel,
}: {
  onRun: () => Promise<ActionOutcome | void>;
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  icon?: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  disabledReason?: string;
  title?: string;
  className?: string;
  successLabel?: string;
}) {
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setPending(true);
    setError(null);
    try {
      const result = await onRun();
      if (result && !result.ok) {
        setError(result.hint ? `${result.error ?? 'Failed'} — ${result.hint}` : result.error ?? 'Action failed');
        return;
      }
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex min-w-0 flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => void run()}
        disabled={pending || disabled}
        title={disabled ? disabledReason ?? title : title}
        className={adminButtonClass(variant, size, className)}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : done ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          Icon && <Icon className="h-3.5 w-3.5" />
        )}
        {pending ? pendingLabel ?? children : done && successLabel ? successLabel : children}
      </button>
      {error && (
        <span role="alert" className="max-w-[16rem] text-[10px] leading-snug text-red-400">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * Two-tap confirmation for anything irreversible (refunds, role changes,
 * challenge failure). Deliberately NOT `window.confirm`: it is suppressed in
 * some in-app browsers and blocks the whole page.
 */
export function ConfirmActionButton({
  label,
  confirmLabel,
  onRun,
  variant = 'danger',
  size = 'md',
  icon: Icon,
  title,
  disabled,
}: {
  label: string;
  confirmLabel: string;
  onRun: () => Promise<ActionOutcome | void>;
  variant?: ButtonVariant;
  size?: keyof typeof SIZES;
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function confirm() {
    setPending(true);
    try {
      const result = await onRun();
      if (result && !result.ok) {
        toast.error(result.hint ? `${result.error ?? 'Failed'} — ${result.hint}` : result.error ?? 'Action failed');
        return;
      }
      setArmed(false);
    } finally {
      setPending(false);
      if (timer.current) clearTimeout(timer.current);
    }
  }

  return (
    <button
      type="button"
      disabled={pending || disabled}
      title={title}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          timer.current = setTimeout(() => setArmed(false), 5000);
          return;
        }
        void confirm();
      }}
      className={adminButtonClass(armed ? 'danger' : variant, size)}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : armed ? (
        <TriangleAlert className="h-3.5 w-3.5" />
      ) : (
        Icon && <Icon className="h-3.5 w-3.5" />
      )}
      {armed ? confirmLabel : label}
    </button>
  );
}
