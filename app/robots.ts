import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/dashboard/', '/auth/', '/api/'],
      },
    ],
    sitemap: 'https://conjuncture.work/sitemap.xml',
  };
}
