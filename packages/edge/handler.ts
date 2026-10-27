import { Hono } from 'hono';
import { serve } from 'std/server';
import { BloomFilter } from './bloomFilter';

const app = new Hono();

// KV abstraction for Map or Cloudflare KV
interface KVStore {
  get(key: string): Promise<string | undefined>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
// Detect Cloudflare KV namespace
const kv: KVStore = typeof globalThis !== 'undefined' && 'KV_NAMESPACE' in globalThis
  ? (globalThis as any).KV_NAMESPACE as KVStore
  : {
      get: async (k) => (globalThis as any).kv?.get(k),
      put: async (k, v) => (globalThis as any).kv?.put(k, v),
      delete: async (k) => (globalThis as any).kv?.delete(k),
    };

// Load Bloom filter from KV or create new
let bloom = new BloomFilter();
const BLOOM_KEY = 'slop_filter_bloom';
(async () => {
  const data = await kv.get(BLOOM_KEY);
  if (data) bloom = BloomFilter.fromJSON(JSON.parse(data));
})();

// Helper to persist bloom after mutation
const persistBloom = async () => {
  await kv.put(BLOOM_KEY, JSON.stringify(bloom.toJSON()));
};

app.get('/v1/bucket/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  if (bloom.test(prefix)) {
    return c.json({ verdict: 'BLOCK' });
  }
  const kvVal = await kv.get(prefix);
  if (kvVal === 'true') {
    return c.json({ verdict: 'BLOCK' });
  }
  return c.json({ verdict: 'ALLOW' });
});

app.post('/v1/bucket/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  bloom.add(prefix);
  await kv.put(prefix, 'true');
  await persistBloom();
  return c.json({ status: 'added' });
});

app.get('/health', async () => ({ status: 'ok' }));

  const prefix = c.req.param('prefix');
  bloom.add(prefix);
  await kv.put(prefix, 'true');
  await persistBloom();
  return c.json({ status: 'added' });
});

serve(app);
