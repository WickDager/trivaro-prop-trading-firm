import type { MetadataRoute } from 'next';
import { APP_URL } from '@/lib/constants';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Authenticated areas have nothing to index and would only leak the
      // existence of user-specific routes.
      disallow: ['/dashboard', '/admin', '/payments', '/challenge', '/api', '/auth'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  };
}
