import type { MetadataRoute } from 'next';
import { getTenders } from '@/lib/data-service';
import { getProjects } from '@/lib/data-service';

const SITE_URL = 'https://conjuncture.work';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [tenders, projects] = await Promise.all([
    getTenders().catch(() => []),
    getProjects().catch(() => []),
  ]);

  const tenderEntries: MetadataRoute.Sitemap = tenders.map((t) => ({
    url: `${SITE_URL}/tenders/${t.id}`,
    lastModified: t.deadline ? new Date(t.deadline) : new Date(),
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  const projectEntries: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${SITE_URL}/projects/${p.id}`,
    changeFrequency: 'weekly',
    priority: 0.6,
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
    {
      url: `${SITE_URL}/projects`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...tenderEntries,
    ...projectEntries,
  ];
}
