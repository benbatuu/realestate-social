// Creates the test database if needed, applies migrations, seeds plans and (with --truncate)
// empties all other tables. Used by Vitest integration tests and Playwright E2E tests.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { CreateBucketCommand, HeadBucketCommand, S3Client } from '@aws-sdk/client-s3';
import { Client } from 'pg';

const API_ROOT = path.resolve(__dirname, '..');

/** Every table except the seeded plan catalogue and Prisma's migration log. */
export const TEST_TABLES = [
  'sync_run_row_errors',
  'sync_runs',
  'property_assets',
  'properties',
  'crm_connections',
  'audit_logs',
  'invitations',
  'subscriptions',
  'memberships',
  'sessions',
  'tenants',
  'users',
].join(', ');

/** Tests never write to the development bucket. */
async function ensureTestBucket(): Promise<void> {
  const bucket = process.env['TEST_OBJECT_STORAGE_BUCKET'];
  if (!bucket || !bucket.endsWith('-test')) {
    throw new Error('TEST_OBJECT_STORAGE_BUCKET must be set and end in -test');
  }
  const client = new S3Client({
    endpoint: process.env['OBJECT_STORAGE_ENDPOINT'] ?? '',
    region: process.env['OBJECT_STORAGE_REGION'] ?? 'us-east-1',
    forcePathStyle: process.env['OBJECT_STORAGE_FORCE_PATH_STYLE'] === 'true',
    credentials: {
      accessKeyId: process.env['OBJECT_STORAGE_ACCESS_KEY'] ?? '',
      secretAccessKey: process.env['OBJECT_STORAGE_SECRET_KEY'] ?? '',
    },
  });
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } finally {
    client.destroy();
  }
}

export async function prepareTestDatabase(options: { truncate: boolean }): Promise<void> {
  loadDotenv({ path: path.resolve(API_ROOT, '../../.env'), quiet: true });
  const testUrl = process.env['TEST_DATABASE_URL'];
  if (!testUrl) throw new Error('TEST_DATABASE_URL is not set (see .env.example)');

  const dbName = new URL(testUrl).pathname.slice(1);
  if (!/^[a-z0-9_]+$/.test(dbName) || !dbName.endsWith('_test')) {
    throw new Error('TEST_DATABASE_URL must point to a database whose name ends in _test');
  }

  const admin = new URL(testUrl);
  admin.pathname = '/postgres';
  const adminClient = new Client({ connectionString: admin.toString() });
  await adminClient.connect();
  const exists = await adminClient.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await adminClient.query(`CREATE DATABASE "${dbName}"`);
  await adminClient.end();

  const env = { ...process.env, DATABASE_URL: testUrl };
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: API_ROOT,
    env,
    stdio: 'pipe',
  });
  execFileSync('pnpm', ['exec', 'tsx', 'prisma/seed.ts'], { cwd: API_ROOT, env, stdio: 'pipe' });

  await ensureTestBucket();

  if (options.truncate) {
    const client = new Client({ connectionString: testUrl });
    await client.connect();
    await client.query(`TRUNCATE ${TEST_TABLES} CASCADE`);
    await client.end();
  }
}

if (require.main === module) {
  prepareTestDatabase({ truncate: process.argv.includes('--truncate') }).catch((err: unknown) => {
    console.error('prepare-test-db failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
