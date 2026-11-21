import type { DependencyName, DependencyStatus, HealthResponse } from '@app/shared';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../infra/prisma.service';
import { RedisService } from '../infra/redis.service';
import { StorageService } from '../infra/storage.service';

const CHECK_TIMEOUT_MS = 3_000;

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly storage: StorageService,
  ) {}

  async check(): Promise<HealthResponse> {
    const [database, redis, storage] = await Promise.all([
      this.probe('database', async () => {
        await this.prisma.$queryRaw`SELECT 1`;
      }),
      this.probe('redis', () => this.redis.ping()),
      this.probe('storage', () => this.storage.ping()),
    ]);
    const allOk = [database, redis, storage].every((d) => d.status === 'ok');
    return {
      status: allOk ? 'ok' : 'degraded',
      checkedAt: new Date().toISOString(),
      dependencies: { database, redis, storage },
    };
  }

  private async probe(name: DependencyName, fn: () => Promise<void>): Promise<DependencyStatus> {
    const started = performance.now();
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        fn(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
        }),
      ]);
      return { status: 'ok', latencyMs: Math.round(performance.now() - started) };
    } catch (err) {
      return {
        status: 'error',
        latencyMs: Math.round(performance.now() - started),
        // Error names only: driver messages can contain hosts or connection strings.
        error: `${name} check failed (${err instanceof Error ? err.name : 'unknown'}${
          err instanceof Error && err.message === 'timeout' ? ': timeout' : ''
        })`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
