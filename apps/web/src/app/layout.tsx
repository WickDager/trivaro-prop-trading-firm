import type { Metadata, Viewport } from 'next';
import { Toaster } from '@/components/ui/toast';
import '@/styles/globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0A1628',
};

export const metadata: Metadata = {
  title: 'Trivaro — Prop Trading Firm',
  description:
    'From demo to funded. Pass our trading challenge and get funded with real capital. Keep up to 90% of the profits.',
  icons: {
    icon: '/icons/trivaro-icon.svg',
  },
  openGraph: {
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
      <body className="min-h-screen overflow-x-hidden bg-navy-800 antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
