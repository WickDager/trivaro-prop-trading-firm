import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Trivaro — Prop Trading Firm',
    short_name: 'Trivaro',
    description:
      'Pass our trading challenge and get funded with real capital. Keep up to 90% of the profits.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0A1628',
    theme_color: '#0A1628',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/trivaro-icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
