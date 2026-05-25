'use client';

import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';
import { GradientText } from '@/components/shared/GradientText';
import { Mail, MessageCircle, Clock } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="min-h-screen pt-24">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-4xl font-bold sm:text-5xl">
              Contact <GradientText as="span">Us</GradientText>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Have questions? We are here to help.
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          <RevealOnScroll delay={0.1}>
            <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                <MessageCircle className="h-6 w-6" />
              </div>
              <h3 className="mb-2 font-heading text-lg font-semibold">Telegram</h3>
              <p className="text-sm text-text-secondary">@TrivaroSupport</p>
              <p className="mt-1 text-xs text-text-muted">Fastest response</p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={0.2}>
            <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                <Mail className="h-6 w-6" />
              </div>
              <h3 className="mb-2 font-heading text-lg font-semibold">Email</h3>
              <p className="text-sm text-text-secondary">support@trivaro.com</p>
              <p className="mt-1 text-xs text-text-muted">24h response time</p>
            </div>
          </RevealOnScroll>

          <RevealOnScroll delay={0.3}>
            <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                <Clock className="h-6 w-6" />
              </div>
              <h3 className="mb-2 font-heading text-lg font-semibold">Hours</h3>
              <p className="text-sm text-text-secondary">24/7 Support</p>
              <p className="mt-1 text-xs text-text-muted">Weekends included</p>
            </div>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delay={0.2}>
          <div className="mx-auto mt-12 max-w-lg">
            <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-8">
              <h2 className="mb-6 text-center font-heading text-xl font-semibold">
                Send Us a Message
              </h2>
              <form
                onSubmit={(e) => e.preventDefault()}
                className="space-y-4"
              >
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Name</label>
                  <input
                    type="text"
                    className="w-full rounded-lg border border-teal-500/10 bg-navy-800 px-4 py-2 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                    placeholder="Your name"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Email</label>
                  <input
                    type="email"
                    className="w-full rounded-lg border border-teal-500/10 bg-navy-800 px-4 py-2 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                    placeholder="your@email.com"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-text-secondary">Message</label>
                  <textarea
                    rows={4}
                    className="w-full rounded-lg border border-teal-500/10 bg-navy-800 px-4 py-2 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                    placeholder="How can we help?"
                  />
                </div>
                <GlowButton type="submit" className="w-full">
                  Send Message
                </GlowButton>
              </form>
            </div>
          </div>
        </RevealOnScroll>
      </div>
    </div>
  );
}
