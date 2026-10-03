import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toast';
import { MotionProvider } from '@/components/shared/MotionProvider';
import '@/styles/globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Required for env(safe-area-inset-*) to report real values on notched
  // devices; without it the mobile nav sits under the home indicator.
  viewportFit: 'cover',
  themeColor: '#0A1628',
  // Renders native form controls, scrollbars and the password-reveal button
  // with dark OS chrome instead of light.
  colorScheme: 'dark',
};

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Trivaro — Prop Trading Firm',
    template: '%s | Trivaro',
  },
  description:
    'From demo to funded. Pass our trading challenge and get funded with real capital. Keep up to 90% of the profits.',
  applicationName: 'Trivaro',
  icons: {
    icon: '/icons/trivaro-icon.svg',
    apple: '/icons/trivaro-icon.svg',
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    siteName: 'Trivaro',
    title: 'Trivaro — Prop Trading Firm',
    description: 'From demo to funded. Start your trading career today.',
    images: ['/brand/trivaro-social-banner.svg'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Trivaro — Prop Trading Firm',
    description: 'From demo to funded. Start your trading career today.',
    images: ['/brand/trivaro-social-banner.svg'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-navy-800 antialiased">
        {/* Keyboard users otherwise tab through ~6 nav links on every page. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-teal-500 focus:px-4 focus:py-2.5 focus:font-medium focus:text-navy-900"
        >
          Skip to content
        </a>
        <MotionProvider>{children}</MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}
