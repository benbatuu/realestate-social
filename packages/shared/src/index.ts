export * from './auth';
export * from './credits';
export * from './video';
export * from './manifest';
export * from './library';
export * from './errors';
export * from './health';
export * from './properties';
export * from './tenants';

/** Every public API route lives under this prefix (blueprint §11). */
export const API_PREFIX = 'api/v1';

/**
 * Product name shown in the UI. The brand is undecided (blueprint header), so nothing
 * else in the codebase may hard-code a brand name.
 */
export const PRODUCT_DISPLAY_NAME = 'Portfolio Studio';
export * from './enrichment';
export * from './leads';
export * from './analytics';
export * from './integrations';
export * from './subscriptions';
export * from './notifications';
export * from './notification-catalog';
