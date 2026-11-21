import { execFileSync } from 'node:child_process';
import path from 'node:path';

/** Fresh test database for every E2E run (migrations, plan seed, empty tables). */
export default function globalSetup(): void {
  execFileSync('pnpm', ['run', 'db:test:prepare', '--truncate'], {
    cwd: path.resolve(__dirname, '../../api'),
    stdio: 'inherit',
  });
}
