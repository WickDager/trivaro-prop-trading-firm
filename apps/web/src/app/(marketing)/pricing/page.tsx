import type { Metadata } from 'next';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';
import { CHALLENGE_PRICING } from '@/lib/constants';
import { ChallengeCard } from './ChallengeCard';

const title = 'Pricing';
const description =
  'Compare Trivaro challenge accounts and one-time fees, with profit targets, drawdown limits and minimum trading days listed for every account size.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/pricing' },
  openGraph: {
    type: 'website',
    url: '/pricing',
    siteName: 'Trivaro',
    title,
    description,
    images: ['/brand/trivaro-social-banner.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/brand/trivaro-social-banner.svg'],
  },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">
              Simple <GradientText as="span">Pricing</GradientText>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              One-time fee. No hidden costs. No monthly subscriptions.
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {CHALLENGE_PRICING.map((challenge, i) => (
            <RevealOnScroll key={challenge.accountSize} delay={i * 0.1}>
              <ChallengeCard challenge={challenge} />
            </RevealOnScroll>
          ))}
        </div>

        <RevealOnScroll delay={0.2}>
          <div className="mt-16 rounded-xl border border-teal-500/10 bg-navy-700/60 p-8">
            <h2 className="mb-4 text-center font-heading text-2xl font-bold">
              Challenge <GradientText as="span">Comparison</GradientText>
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-teal-500/10 text-left text-text-muted">
                    <th className="pb-3 pr-4 font-medium">Account Size</th>
                    <th className="pb-3 pr-4 font-medium">Balance Challenge</th>
                    <th className="pb-3 pr-4 font-medium">Equity Challenge</th>
                    <th className="pb-3 pr-4 font-medium">Profit Target</th>
                    <th className="pb-3 font-medium">Max Drawdown</th>
                  </tr>
                </thead>
                <tbody>
                  {CHALLENGE_PRICING.map((challenge) => (
                    <tr key={challenge.accountSize} className="border-b border-teal-500/5">
                      <td className="py-3 pr-4 font-semibold">
                        ${(challenge.accountSize / 1000).toFixed(0)}K
                      </td>
                      <td className="py-3 pr-4 text-green-400">${challenge.balanceChallenge}</td>
                      <td className="py-3 pr-4 text-teal-400">${challenge.equityChallenge}</td>
                      <td className="py-3 pr-4">{challenge.profitTarget}%</td>
                      <td className="py-3">{challenge.maxDrawdown}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
