import type { Metadata } from 'next';
import Link from 'next/link';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';

const title = 'Terms of Service';
const description =
  'The terms that govern your use of Trivaro: challenge participation rules, cryptocurrency payments and refunds, intellectual property and liability.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/terms' },
  openGraph: {
    type: 'website',
    url: '/terms',
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

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <h1 className="font-heading text-4xl font-bold">
            Terms of <GradientText as="span">Service</GradientText>
          </h1>
          <p className="mt-2 text-sm text-text-muted">Last updated: October 17, 2026</p>
        </RevealOnScroll>

        <div className="mt-12 space-y-8 text-sm text-text-secondary leading-relaxed">
          <RevealOnScroll>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">1. Acceptance of Terms</h2>
              <p>
                By accessing or using Trivaro (&quot;the Platform&quot;), you agree to be bound by these Terms of Service.
                If you do not agree, do not use the Platform.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.05}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">2. Challenge Rules</h2>
              <p>
                Participants must complete the trading challenge within the specified rules: profit targets,
                maximum drawdown limits, minimum trading days, and the conduct rules covering news trading,
                Expert Advisors, high-frequency trading and copy trading. The full rulebook is published on
                our{' '}
                <Link href="/rules" className="text-teal-400 hover:underline">
                  Challenge Rules
                </Link>{' '}
                page. Failure to comply may result in disqualification. All trading is conducted in a
                simulated environment. The free trial described in Section 3 is graded on the same
                rules but is not a paid evaluation.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">3. Free Trial</h2>
              <p>
                Trivaro offers one free trial per trader: a $10,000 simulated practice account for 14
                days, graded by the same risk engine and subject to the same profit-target, drawdown,
                minimum-trading-day and conduct rules as a paid challenge. No card or payment is
                required. Reaching the trial&apos;s profit target marks the trial as passed and invites
                you to purchase a paid challenge; it does not advance a phase, create a funded
                account, or entitle you to a profit split or any payout. When the 14-day period ends,
                the trial account stops accepting trades and is closed as expired. A paid challenge
                is a separate account with its own starting balance, and the trial result does not
                carry over to it. Trial accounts are not eligible for refunds because no fee is paid.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.125}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">4. Payments & Refunds</h2>
              <p>
                All payments are processed in cryptocurrency — USDT on Tron (TRC20), USDC on Ethereum (ERC20) or Bitcoin —
                and are non-refundable once you have accessed
                your trading account. If you never access your Phase 1 account, you may request a full
                refund within 7 days of purchase. Refunds are otherwise issued at management&apos;s
                discretion for qualifying circumstances. See our Refund Policy for details.
              </p>
              <p className="mt-3">
                Each order quotes an exact cryptocurrency amount and a deposit address, and is
                verified on-chain against that address. The quoted amount must be sent within the
                30-minute window shown at checkout; an order that expires does not lock in the
                price and can be recreated at the current rate.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">5. Intellectual Property</h2>
              <p>
                All content, logos, and materials on the Platform are the property of Trivaro and may not
                be reproduced without written consent.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.2}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">6. Limitation of Liability</h2>
              <p>
                Trivaro is not liable for any losses incurred during trading challenges. All trading
                involves risk. Participants should only trade with funds they can afford to lose.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.25}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">7. Contact</h2>
              <p>
                For questions about these terms, contact us at support@trivaro.com.
              </p>
            </section>
          </RevealOnScroll>
        </div>
      </div>
    </div>
  );
}
