import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing under /data/ is meant to be indexed: it is the JSON the app
        // fetches, and indexing it would surface answer keys in search results.
        disallow: ['/data/'],
      },
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
  };
}
