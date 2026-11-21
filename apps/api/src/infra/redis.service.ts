import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { APP_CONFIG, type AppConfig } from '../config/config.module';

/** Plain Redis client for cache, rate limits and locks. BullMQ manages its own connections. */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = new Redis(config.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 2_000,
    });
  }

  async ensureConnected(): Promise<void> {
    if (this.client.status === 'wait') await this.client.connect();
  }

  async ping(): Promise<void> {
    await this.ensureConnected();
    const reply = await this.client.ping();
    if (reply !== 'PONG') throw new Error('Unexpected PING reply');
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
