import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { CheckoutClient } from './CheckoutClient';

/**
 * Server component so this route can export metadata — a `'use client'` page
 * cannot, which is why every marketing page previously shared the root title.
 * The interactive checkout lives in CheckoutClient.
 */
export const metadata: Metadata = {
  title: 'Challenges',
  description:
    'Compare Trivaro challenge accounts, start a free 14-day practice trial, or buy a funded evaluation with USDT. Profit target, drawdown limits and fees for every account size.',
  alternates: { canonical: '/challenges' },
  openGraph: {
    type: 'website',
    url: '/challenges',
    siteName: 'Trivaro',
    title: 'Challenges | Trivaro',
    description:
      'Start a free 14-day practice trial or buy a funded evaluation. Profit target, drawdown limits and fees for every account size.',
    images: ['/brand/trivaro-social-banner.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Challenges | Trivaro',
    description:
      'Start a free 14-day practice trial or buy a funded evaluation. Profit target, drawdown limits and fees for every account size.',
    images: ['/brand/trivaro-social-banner.svg'],
  },
};

export default function ChallengesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center pt-24">
          <Loader2 className="h-6 w-6 animate-spin text-teal-400" />
        </div>
      }
    >
      <CheckoutClient />
    </Suspense>
  );
}
