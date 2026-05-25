'use client';

import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';

export default function TermsPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <h1 className="font-heading text-4xl font-bold">
            Terms of <GradientText as="span">Service</GradientText>
          </h1>
          <p className="mt-2 text-sm text-text-muted">Last updated: May 25, 2026</p>
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
                maximum drawdown limits, and minimum trading days. Failure to comply may result in
                disqualification. All trading is conducted in a simulated environment.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">3. Payments & Refunds</h2>
              <p>
                All payments are processed in cryptocurrency. Challenge fees are non-refundable once the
                challenge has been accessed. Refunds may be issued at management&apos;s discretion for
                qualifying circumstances. See our Refund Policy for details.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">4. Intellectual Property</h2>
              <p>
                All content, logos, and materials on the Platform are the property of Trivaro and may not
                be reproduced without written consent.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.2}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">5. Limitation of Liability</h2>
              <p>
                Trivaro is not liable for any losses incurred during trading challenges. All trading
                involves risk. Participants should only trade with funds they can afford to lose.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.25}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">6. Contact</h2>
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
