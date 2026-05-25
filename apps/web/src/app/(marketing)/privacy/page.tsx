'use client';

import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <h1 className="font-heading text-4xl font-bold">
            Privacy <GradientText as="span">Policy</GradientText>
          </h1>
          <p className="mt-2 text-sm text-text-muted">Last updated: May 25, 2026</p>
        </RevealOnScroll>

        <div className="mt-12 space-y-8 text-sm text-text-secondary leading-relaxed">
          <RevealOnScroll>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">1. Information We Collect</h2>
              <p>
                We collect information you provide during registration (name, email) and usage data
                (pages visited, trading activity). We do not collect sensitive financial information
                as all payments are processed through third-party blockchain networks.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.05}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">2. How We Use Your Information</h2>
              <p>
                We use your information to operate the Platform, process challenges, communicate with you,
                and improve our services. We do not sell your personal information to third parties.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.1}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">3. Data Security</h2>
              <p>
                We implement industry-standard security measures including encryption at rest and in transit.
                Account passwords are stored using bcrypt hashing. API keys are stored as environment variables
                and never exposed client-side.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.15}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">4. Third-Party Services</h2>
              <p>
                We use Supabase for authentication and database, Vercel for hosting, and Telegram for payment
                communication. Each service has its own privacy policy governing data handling.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.2}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">5. Your Rights</h2>
              <p>
                You may request access to, correction of, or deletion of your personal data at any time
                by contacting support@trivaro.com.
              </p>
            </section>
          </RevealOnScroll>

          <RevealOnScroll delay={0.25}>
            <section>
              <h2 className="mb-3 font-heading text-lg font-semibold text-white">6. Contact</h2>
              <p>
                For privacy-related inquiries, contact us at support@trivaro.com.
              </p>
            </section>
          </RevealOnScroll>
        </div>
      </div>
    </div>
  );
}
