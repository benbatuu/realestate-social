import path from 'node:path';
import { config as loadDotenv } from 'dotenv';

/**
 * Loads the repository-root .env for local development. Values already present in the process
 * environment win, so deployed environments are never overridden by a stray file.
 * Works from both src/ and dist/ since both sit at the same depth.
 */
export function loadLocalEnvFile(): void {
  if (process.env['NODE_ENV'] === 'production') return;
  loadDotenv({ path: path.resolve(__dirname, '../../../../.env'), quiet: true });
}
