import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  serverExternalPackages: ['firebase-admin', 'google-auth-library', '@google-cloud/firestore', 'playwright', 'playwright-core', 'fsevents'],
};

export default nextConfig;
