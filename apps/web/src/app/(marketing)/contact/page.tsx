import type { Metadata } from 'next';
import { RevealOnScroll } from '@/components/animations/RevealOnScroll';
import { GradientText } from '@/components/shared/GradientText';
import { Mail, MessageCircle, Clock } from 'lucide-react';
import { ContactForm } from './ContactForm';

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Get in touch with the Trivaro team. Reach us on Telegram for the fastest response, by email, or send a message through the contact form.',
  alternates: { canonical: '/contact' },
  openGraph: {
    type: 'website',
    url: '/contact',
    siteName: 'Trivaro',
    title: 'Contact | Trivaro',
    description:
      'Get in touch with the Trivaro team on Telegram, by email, or through the contact form.',
    images: ['/brand/trivaro-social-banner.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact | Trivaro',
    description:
      'Get in touch with the Trivaro team on Telegram, by email, or through the contact form.',
    images: ['/brand/trivaro-social-banner.svg'],
  },
};

const CHANNELS = [
  { icon: MessageCircle, title: 'Telegram', value: '@TrivaroSupport', note: 'Fastest response' },
  { icon: Mail, title: 'Email', value: 'support@trivaro.com', note: '24h response time' },
  { icon: Clock, title: 'Hours', value: '24/7 Support', note: 'Weekends included' },
];

export default function ContactPage() {
  return (
    <div className="min-h-dvh pt-24">
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        <RevealOnScroll>
          <div className="text-center">
            <h1 className="font-heading text-3xl font-bold sm:text-5xl">
              Contact <GradientText as="span">Us</GradientText>
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-text-secondary">
              Have questions? We are here to help.
            </p>
          </div>
        </RevealOnScroll>

        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {CHANNELS.map((channel, i) => {
            const Icon = channel.icon;
            return (
              <RevealOnScroll key={channel.title} delay={0.1 * (i + 1)}>
                <div className="rounded-xl border border-teal-500/10 bg-navy-700/60 p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h2 className="mb-2 font-heading text-lg font-semibold">{channel.title}</h2>
                  <p className="text-sm text-text-secondary">{channel.value}</p>
                  <p className="mt-1 text-xs text-text-muted">{channel.note}</p>
                </div>
              </RevealOnScroll>
            );
          })}
        </div>

        <ContactForm />
      </div>
    </div>
  );
}
