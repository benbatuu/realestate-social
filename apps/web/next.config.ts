import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';

// One .env at the repository root serves every app; existing env vars take precedence.
loadDotenv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
