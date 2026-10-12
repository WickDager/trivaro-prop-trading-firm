'use client';

import { Clock, Mail, ShieldCheck } from 'lucide-react';

export type CredentialStatus = 'none' | 'pending' | 'provisioned' | 'sent' | null;

export function CredentialStatusBanner({
  status,
  isTrial,
}: {
  status: CredentialStatus;
  isTrial?: boolean;
}) {
  if (status === 'sent') return null; // Delivered — nothing to say.

  if (status === 'provisioned') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Your MT5 account has been set up and is in final verification.
          Login details will arrive by email shortly — no action needed.
        </p>
      </div>
    );
  }

  // 'pending' or 'none' — account not issued yet.
  return (
    <div className="flex items-start gap-3 rounded-xl border border-teal-500/20 bg-teal-500/10 px-4 py-3 text-sm text-teal-300">
      <Clock className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1 rounded-lg">
        <p>
          {isTrial
            ? 'Your free trial is active and your MT5 account is under review.'
            : 'Your purchase is under review.'}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-teal-400/80">
          <Mail className="h-3 w-3" />
          MT5 credentials will be emailed within 24 hours. Nothing further is needed from you.
        </p>
      </div>
    </div>
  );
}
