import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Authenticated areas have nothing to index and would only leak the
      // existence of user-specific routes.
      disallow: ['/dashboard', '/admin', '/payments', '/challenge', '/api', '/auth'],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
