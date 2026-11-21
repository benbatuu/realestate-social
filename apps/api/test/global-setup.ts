import { prepareTestDatabase } from '../scripts/prepare-test-db';

/** Runs once before integration tests. Tests never touch the development database. */
export default async function globalSetup(): Promise<void> {
  await prepareTestDatabase({ truncate: false });
}
