'use client';

import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';

export default function RefundPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <h1 className="font-heading text-4xl font-bold">
            Refund <GradientText as="span">Policy</GradientText>
          </h1>
          <p className="mt-2 text-sm text-text-muted">Last updated: May 25, 2026</p>
        </RevealOnScroll>

        <div className="mt-12 space-y-8 text-sm text-text-secondary leading-relaxed">
          <RevealOnScroll>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">1. Challenge Fees</h2>
              <p>
                Challenge fees are one-time payments for accessing our evaluation program. Once a challenge
                has been activated and the account credentials have been delivered, the fee is considered
                earned and is non-refundable.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.05}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">2. Phase 1 Refund Guarantee</h2>
              <p>
                If you fail Phase 1 without having accessed your trading account, you may request a full
                refund within 7 days of purchase. Refunds are processed in the same cryptocurrency used
                for the original payment.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">3. Technical Issues</h2>
              <p>
                If you experience a technical issue on our end that prevents you from trading, we will
                either extend your challenge period or issue a full refund at our discretion.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">4. Refund Process</h2>
              <p>
                To request a refund, contact support@trivaro.com with your order ID and reason. Refunds
                are processed within 5-10 business days. Due to the nature of cryptocurrency transactions,
                the refund amount may vary based on market conditions.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.2}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">5. Chargebacks</h2>
              <p>
                Cryptocurrency transactions are irreversible. Chargebacks are not possible. By purchasing
                a challenge, you acknowledge that you have read and understood this policy.
              </p>
            </section>
          </RevealOnScroll>
        </div>
      </div>
    </div>
  );
}
