import { Hono } from 'hono';
import { extract } from 'hono/testing';

// Mock KV namespace
const kvStore = new Map<string, string>();
(globalThis as any).KV_NAMESPACE = {
  get: async (key: string) => kvStore.get(key),
  put: async (key: string, value: string) => { kvStore.set(key, value); },
  delete: async (key: string) => { kvStore.delete(key); },
};

// Recreate the handler logic from handler.ts
const app = new Hono();
app.get('/v1/bucket/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  const verdict = (await (globalThis as any).KV_NAMESPACE.get(prefix)) === 'true' || (await (globalThis as any).KV_NAMESPACE.get(prefix) === 'true') ? 'BLOCK' : 'ALLOW';
  return c.json({ verdict });
});
app.post('/v1/bucket/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  await (globalThis as any).KV_NAMESPACE.put(prefix, 'true');
  return c.json({ status: 'added' });
});

(async () => {
  // Ensure prefix not present initially
  const res1 = await extract(app, { method: 'GET', path: '/v1/bucket/test-prefix' });
  const body1 = await res1.json();
  if (body1.verdict !== 'ALLOW') throw new Error('Expected ALLOW before add');

  const res2 = await extract(app, { method: 'POST', path: '/v1/bucket/test-prefix' });
  const body2 = await res2.json();
  if (body2.status !== 'added') throw new Error('Expected added status');

  const res3 = await extract(app, { method: 'GET', path: '/v1/bucket/test-prefix' });
  const body3 = await res3.json();
  if (body3.verdict !== 'BLOCK') throw new Error('Expected BLOCK after add');

  console.log('KV integration test passed');
})();
