import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

// Account pages (dashboard, profile, orders…) stay crawlable so Google can see
// their `noindex` meta and drop them; only areas with no public value at all
// are blocked outright to save crawl budget.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/auth/', '/checkout', '/books/*/read', '/*?*filter=purchased'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
