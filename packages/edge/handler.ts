import { Hono } from 'hono';
import { serve } from 'std/server';
import { BloomFilter } from './bloomFilter';

const app = new Hono();

// Simple in‑memory KV placeholder (in real worker, use env KV namespace)
const kv = new Map<string, boolean>();

// Bloom filter instance shared across requests (not persisted across worker restarts)
const bloom = new BloomFilter();

app.get('/v1/bucket/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  // Check Bloom filter first
  if (bloom.test(prefix)) {
    return c.json({ verdict: 'BLOCK' });
  }
  // If not in Bloom, check KV as a more accurate fallback
  if (kv.get(prefix)) {
    return c.json({ verdict: 'BLOCK' });
  }
  return c.json({ verdict: 'ALLOW' });
});

app.post('/v1/bucket/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  // Add to Bloom and KV to mark as blocked
  bloom.add(prefix);
  kv.set(prefix, true);
  return c.json({ status: 'added' });
});

serve(app);
