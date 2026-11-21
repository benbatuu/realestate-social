// Creates the test database if needed, applies migrations, seeds plans and (with --truncate)
// empties all other tables. Used by Vitest integration tests and Playwright E2E tests.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { Client } from 'pg';

const API_ROOT = path.resolve(__dirname, '..');

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

  if (options.truncate) {
    const client = new Client({ connectionString: testUrl });
    await client.connect();
    await client.query(
      'TRUNCATE audit_logs, invitations, subscriptions, memberships, sessions, tenants, users CASCADE',
    );
    await client.end();
  }
}

if (require.main === module) {
  prepareTestDatabase({ truncate: process.argv.includes('--truncate') }).catch((err: unknown) => {
    console.error('prepare-test-db failed:', err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
