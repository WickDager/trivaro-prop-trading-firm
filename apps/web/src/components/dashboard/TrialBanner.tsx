'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Gift, CheckCircle2, Clock } from 'lucide-react';

interface TrialBannerProps {
  trialEndsAt: string | null;
  trialPassedAt: string | null;
}

function daysLeft(endsAt: string | null): number | null {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/**
 * Free trials run on the same dashboard as a paid challenge. This is the only
 * place the difference is visible — it must be obvious that a trial cannot be
 * funded, so nobody mistakes a passed trial for a funded account.
 */
export function TrialBanner({ trialEndsAt, trialPassedAt }: TrialBannerProps) {
  // Computed after mount: Date.now() during render differs between the server
  // and the client and would be a hydration mismatch.
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    setRemaining(daysLeft(trialEndsAt));
  }, [trialEndsAt]);

  const passed = Boolean(trialPassedAt);

  if (passed) {
    return (
      <div className="rounded-xl border border-green-400/30 bg-green-500/5 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-400" />
            <div>
              <h2 className="font-heading text-base font-semibold">
                You passed your free trial
              </h2>
              <p className="mt-1 text-sm text-text-secondary">
                Nice work. A trial account is for practice only — it isn&apos;t funded and pays no
                profit split. Start a real challenge to trade our capital.
              </p>
            </div>
          </div>
          <Link
            href="/challenges"
            className={cn(buttonVariants({ variant: 'glow', size: 'lg' }), 'shrink-0')}
          >
            Get funded
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-teal-500/20 bg-teal-500/5 p-5 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Gift className="mt-0.5 h-5 w-5 shrink-0 text-teal-400" />
          <div>
            <h2 className="font-heading text-base font-semibold">Free trial account</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Practice on live pricing with our rules. This account is not funded and does not pay
              out — start a real challenge when you&apos;re ready.
            </p>
            {remaining !== null && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-text-muted">
                <Clock className="h-3 w-3" />
                {remaining === 0
                  ? 'Ends today'
                  : `${remaining} day${remaining === 1 ? '' : 's'} remaining`}
              </p>
            )}
          </div>
        </div>
        <Link
          href="/challenges"
          className={cn(buttonVariants({ variant: 'outline', size: 'lg' }), 'shrink-0')}
        >
          Get funded
        </Link>
      </div>
    </div>
  );
}
