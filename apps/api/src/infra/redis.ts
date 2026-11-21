import type { ConnectionOptions } from 'bullmq';

/**
 * Turns REDIS_URL into ioredis options for BullMQ. `maxRetriesPerRequest: null` is required by
 * BullMQ workers (blocking commands must not be retried by the client).
 */
export function redisConnectionOptions(redisUrl: string): ConnectionOptions {
  const url = new URL(redisUrl);
  const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : 0;
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db,
    maxRetriesPerRequest: null,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
  };
}
