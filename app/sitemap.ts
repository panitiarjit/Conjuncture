import type { MetadataRoute } from 'next';

const SITE_URL = 'https://conjuncture.work';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL,                         lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/bidtool`,            lastModified: new Date(), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/intelligence`,       lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
    { url: `${SITE_URL}/agency`,             lastModified: new Date(), changeFrequency: 'daily',  priority: 0.8 },
    { url: `${SITE_URL}/plans`,              lastModified: new Date(), changeFrequency: 'daily',  priority: 0.7 },
  ];
}
