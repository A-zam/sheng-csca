import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: `${SITE.url}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/practice/`, lastModified, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE.url}/mock/`, lastModified, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE.url}/review/`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE.url}/progress/`, lastModified, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE.url}/about/`, lastModified, changeFrequency: 'monthly', priority: 0.6 },
  ];
}
