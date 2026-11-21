import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'prisma/config';

// The single .env lives at the repository root.
loadDotenv({ path: path.resolve(__dirname, '../../.env'), quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Optional so `prisma generate` (postinstall) works without a database configured.
  ...(process.env['DATABASE_URL'] ? { datasource: { url: process.env['DATABASE_URL'] } } : {}),
});
