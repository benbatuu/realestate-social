import { createHash } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AppError } from '../common/http/app-error';
import { APP_CONFIG, type AppConfig } from '../config/config.module';
import { RedisService } from '../infra/redis.service';

const WINDOW_SECONDS = 15 * 60;
const MAX_FAILURES_PER_EMAIL = 10;
const MAX_FAILURES_PER_IP = 50;

/**
 * Counts failed logins in Redis (shared across API instances). Keyed by email as well as IP:
 * behind the Next.js rewrite many users can share one source address. Emails are hashed so no
 * personal data is stored in Redis.
 */
@Injectable()
export class LoginThrottleService {
  constructor(
    private readonly redis: RedisService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private keys(email: string, ip: string | undefined): string[] {
    const prefix = `${this.config.NODE_ENV}:login-fail`;
    const emailKey = `${prefix}:email:${createHash('sha256').update(email).digest('hex')}`;
    return ip ? [emailKey, `${prefix}:ip:${ip}`] : [emailKey];
  }

  async assertAllowed(email: string, ip: string | undefined): Promise<void> {
    await this.redis.ensureConnected();
    const [emailKey, ipKey] = this.keys(email, ip);
    const [emailCount, ipCount] = await Promise.all([
      this.redis.client.get(emailKey as string),
      ipKey ? this.redis.client.get(ipKey) : Promise.resolve(null),
    ]);
    if (
      Number(emailCount ?? 0) >= MAX_FAILURES_PER_EMAIL ||
      Number(ipCount ?? 0) >= MAX_FAILURES_PER_IP
    ) {
      throw new AppError(
        HttpStatus.TOO_MANY_REQUESTS,
        'TOO_MANY_ATTEMPTS',
        'Too many failed attempts, try again later',
      );
    }
  }

  async recordFailure(email: string, ip: string | undefined): Promise<void> {
    await this.redis.ensureConnected();
    const pipeline = this.redis.client.multi();
    for (const key of this.keys(email, ip)) {
      pipeline.incr(key);
      pipeline.expire(key, WINDOW_SECONDS, 'NX');
    }
    await pipeline.exec();
  }

  async reset(email: string): Promise<void> {
    await this.redis.ensureConnected();
    const [emailKey] = this.keys(email, undefined);
    await this.redis.client.del(emailKey as string);
  }
}
