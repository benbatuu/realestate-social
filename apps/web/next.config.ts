import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';

// One .env at the repository root serves every app; existing env vars take precedence.
loadDotenv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const apiUrl = process.env['API_URL'];
if (!apiUrl) throw new Error('API_URL is not set');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // E2E runs its own server next to `pnpm dev`; separate build dirs keep them apart.
  distDir: process.env['NEXT_DIST_DIR'] ?? '.next',
  poweredByHeader: false,
  /**
   * The browser talks to the API through this app's own origin, so the session cookie is
   * first-party and no CORS is needed (docs/plan-01, decision 3).
   */
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${apiUrl.replace(/\/$/, '')}/api/v1/:path*` },
    ];
  },
};

export default nextConfig;
