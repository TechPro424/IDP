import { Hono } from 'hono';
import { BloomFilter, type BloomOptions } from './bloomFilter.js';
import { bloomKey, bucketKey, emptyBucket, padBucket, type Bucket } from './keys.js';

export { BUCKET_PAD } from './keys.js';

/** Minimal KV contract (matches Cloudflare KVNamespace for our usage). */
export interface KVStore {
  get(key: string, type?: 'text' | 'arrayBuffer'): Promise<any>;
  put(key: string, value: string | ArrayBuffer | Uint8Array, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

/** Cloudflare Rate Limiting binding ([[ratelimits]] in wrangler.toml). */
export interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

export interface Env {
  /** KV binding — configured in wrangler.toml as [[kv_namespaces]]. */
  KV: KVStore;
  /** Optional: absent in tests and on a plain `wrangler dev`. */
  RATE_LIMITER?: RateLimiter;
  BLOOM_VERSION?: string;
  BLOOM_EXPECTED_ITEMS?: string;
  BLOOM_FPR?: string;
}

export const PREFIX_RE = /^[0-9a-f]{4,16}$/;

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

function apiHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...CORS_HEADERS, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra };
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use('*', async (c, next) => {
    // No cookies / no logging: strip any inbound cookie before handlers.
    c.header('Set-Cookie', '');

    // Cloudflare-side rate limiting (plan §7.3). The key is only used for
    // counting inside the edge location and is not stored by us; when the
    // binding is absent (tests, `wrangler dev`) requests pass through.
    const limiter = c.env.RATE_LIMITER;
    if (limiter && c.req.method !== 'OPTIONS') {
      const { success } = await limiter.limit({ key: c.req.header('CF-Connecting-IP') ?? 'unknown' });
      if (!success) return c.json({ error: 'rate limited' }, 429, apiHeaders({ 'Retry-After': '60' }));
    }

    await next();
  });

  app.options('*', (c) => c.body(null, 204, apiHeaders()));

  app.get('/health', (c) => c.json({ status: 'ok' }, 200, apiHeaders()));

  app.get('/v1/bucket/:prefix', async (c) => {
    const prefix = c.req.param('prefix');
    if (!PREFIX_RE.test(prefix)) return c.json({ error: 'bad prefix' }, 400, apiHeaders());
    const raw = await c.env.KV.get(bucketKey(prefix), 'text');
    const bucket: Bucket = raw ? JSON.parse(raw) : emptyBucket(c.env.BLOOM_VERSION ?? 'model-0');
    // Pad on read as well as at publish time: an absent or thin bucket must be
    // indistinguishable in size from a full one (plan §7.3).
    return c.json(padBucket(bucket), 200, apiHeaders({ 'Cache-Control': 'public, max-age=3600' }));
  });
  // There is deliberately no write route: verdicts are seeded offline by the
  // researcher (`scripts/publish-bloom.ts` + `wrangler kv key put`), so no
  // contribution/upload path exists (guardrail §2.2).

  app.get('/v1/bloom/latest', async (c) => {
    const version = c.env.BLOOM_VERSION ?? 'model-0';
    const stored = await c.env.KV.get(bloomKey(version), 'arrayBuffer');
    const filter = stored
      ? BloomFilter.fromBinary(stored as ArrayBuffer)
      : new BloomFilter(bloomOptions(c.env));
    return c.body(filter.toBinary() as unknown as ArrayBuffer, 200, {
      ...apiHeaders(),
      'Content-Type': 'application/octet-stream',
      'X-Bloom-Version': version,
      'Cache-Control': 'public, max-age=86400',
    });
  });

  return app;
}

function bloomOptions(env: Env): BloomOptions {
  return {
    expectedItems: Number(env.BLOOM_EXPECTED_ITEMS ?? 10_000),
    falsePositiveRate: Number(env.BLOOM_FPR ?? 0.001),
  };
}
export const app = createApp();
export default app;
