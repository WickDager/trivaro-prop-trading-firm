import type { NextConfig } from 'next';

// `unsafe-eval` is only needed by the dev server (React Refresh and the error
// overlay eval their own bundles). Shipping it to production widened the XSS
// surface for no benefit — and the session cookie is deliberately NOT
// httpOnly (the SSR client reads it), so script injection is a session-theft
// path, not just a defacement. `unsafe-inline` stays: Next inlines its own
// bootstrap scripts, and removing it without a nonce breaks hydration.
const isProduction = process.env.NODE_ENV === 'production';
const devScriptSrc = isProduction ? '' : " 'unsafe-eval'";

// Only production can safely ask browsers to upgrade plaintext subresources:
// in dev everything is served over http://localhost, and rewriting those
// requests to https://localhost (where no TLS listener exists) breaks the page.
const upgradeInsecure = isProduction ? ["upgrade-insecure-requests"] : [];

const csp = [
  "default-src 'self'",
  `script-src 'self'${devScriptSrc} 'unsafe-inline' https://challenges.cloudflare.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://api.telegram.org https://*.supabase.co wss://*.supabase.co",
  "frame-src 'self' https://challenges.cloudflare.com",
  "frame-ancestors 'none'",
  // No plugin content is used anywhere; blocking <object>/<embed> removes the
  // oldest remaining script-execution vector CSP can close on its own.
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...upgradeInsecure,
].join('; ');

const nextConfig: NextConfig = {
  // `X-Powered-By: Next.js` tells an attacker which framework (and therefore
  // which advisories) to try first, for no benefit to the customer.
  poweredByHeader: false,
  // Next 16 refuses to serve its dev-only resources (the HMR socket and the
  // dev client that boots hydration) to an origin it does not recognise. The
  // dev server binds `localhost`, so opening the app at http://127.0.0.1:PORT
  // — which is what the preview panel and the e2e runner do — silently served
  // a page that never hydrated: every React handler, including the mobile
  // burger button, was dead. Dev-only; ignored by production builds.
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [
      { hostname: '*.supabase.co' },
    ],
  },
  reactCompiler: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
