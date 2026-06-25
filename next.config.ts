import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/admin', destination: '/login', permanent: false },
    ];
  },
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ['firebase-admin', 'google-auth-library', '@google-cloud/firestore', 'playwright', 'playwright-core', 'fsevents'],
  // Prevent Next.js file tracing from copying playwright/chromium-bidi into
  // .open-next/server-functions/default/node_modules/, which would cause
  // the opennextjs-cloudflare esbuild step to try (and fail) to bundle them.
  outputFileTracingExcludes: {
    '*': [
      'node_modules/playwright/**',
      'node_modules/playwright-core/**',
      'node_modules/chromium-bidi/**',
    ],
  },
};

export default nextConfig;
