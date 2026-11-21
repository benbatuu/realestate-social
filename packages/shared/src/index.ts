export * from './auth';
export * from './errors';
export * from './health';
export * from './tenants';

/** Every public API route lives under this prefix (blueprint §11). */
export const API_PREFIX = 'api/v1';

/**
 * Product name shown in the UI. The brand is undecided (blueprint header), so nothing
 * else in the codebase may hard-code a brand name.
 */
export const PRODUCT_DISPLAY_NAME = 'Portfolio Studio';
