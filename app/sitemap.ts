import type { MetadataRoute } from 'next';
import { getTenders } from '@/lib/data-service';

const SITE_URL = 'https://conjuncture.work';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const tenders = await getTenders().catch(() => []);

  const tenderEntries: MetadataRoute.Sitemap = tenders.map((t) => ({
    url: `${SITE_URL}/tenders/${t.id}`,
    lastModified: t.deadline ? new Date(t.deadline) : new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/tenders`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...tenderEntries,
  ];
}
