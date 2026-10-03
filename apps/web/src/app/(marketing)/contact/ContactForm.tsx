'use client';

import { useState } from 'react';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GlowButton } from '@/components/shared/GlowButton';

const CONTACT_EMAIL = 'support@trivaro.com';

/**
 * Extracted from page.tsx so the page itself can be a server component and
 * export metadata — a `'use client'` module cannot.
 */
export function ContactForm() {
  const [status, setStatus] = useState('');

  // The site has no backend endpoint that accepts this form, so the original
  // handler called alert() and discarded the visitor's message entirely.
  // Rather than pretend, we hand the composed message to the visitor's own
  // mail client: nothing is silently lost, and the cards above still point at
  // Telegram for anyone who prefers it.
  //
  // This sets window.location rather than using <form action="mailto:...">
  // because next.config.ts ships `form-action 'self'` in its CSP, which makes
  // browsers block a native mailto form submission.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const message = String(data.get('message') ?? '').trim();

    const subject = `Trivaro support request from ${name}`;
    const body = `${message}\n\n—\n${name}\n${email}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setStatus('Opening your email app with your message ready to send.');
  }

  return (
    <RevealOnScroll delay={0.2}>
      <div className="mx-auto mt-12 max-w-lg">
        <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-8">
          <h2 className="mb-6 text-center font-heading text-xl font-semibold">
            Send Us a Message
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="contact-name" className="mb-1 block text-sm text-text-secondary">
                Name
              </label>
              <input
                id="contact-name"
                name="name"
                type="text"
                required
                autoComplete="name"
                className="w-full rounded-lg border border-teal-500/10 bg-navy-800 px-4 py-2 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                placeholder="Your name"
              />
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-1 block text-sm text-text-secondary">
                Email
              </label>
              <input
                id="contact-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                className="w-full rounded-lg border border-teal-500/10 bg-navy-800 px-4 py-2 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                placeholder="your@email.com"
              />
            </div>
            <div>
              <label htmlFor="contact-message" className="mb-1 block text-sm text-text-secondary">
                Message
              </label>
              <textarea
                id="contact-message"
                name="message"
                rows={4}
                required
                enterKeyHint="send"
                className="w-full rounded-lg border border-teal-500/10 bg-navy-800 px-4 py-2 text-sm text-white placeholder-text-muted focus:border-teal-400 focus:outline-none"
                placeholder="How can we help?"
              />
            </div>
            <GlowButton type="submit" className="w-full">
              Send Message
            </GlowButton>
            {/* Always rendered so assistive tech announces the update. */}
            <p role="status" aria-live="polite" className="text-center text-xs text-text-muted">
              {status}
            </p>
          </form>
        </div>
      </div>
    </RevealOnScroll>
  );
}
