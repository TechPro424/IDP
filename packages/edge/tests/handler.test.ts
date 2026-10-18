import { Hono } from 'hono';
import { extract } from 'hono/testing';

// Recreate the handler logic
const app = new Hono();
app.get('/v1/bucket/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  const verdict = prefix.startsWith('1') ? 'BLOCK' : 'ALLOW';
  return c.json({ verdict });
});

// Test
(async () => {
  const res1 = await extract(app, {
    method: 'GET',
    path: '/v1/bucket/123',
  });
  const body1 = await res1.json();
  if (body1.verdict !== 'BLOCK') throw new Error('Expected BLOCK');

  const res2 = await extract(app, {
    method: 'GET',
    path: '/v1/bucket/abc',
  });
  const body2 = await res2.json();
  if (body2.verdict !== 'ALLOW') throw new Error('Expected ALLOW');

  console.log('Edge handler test passed');
})();
