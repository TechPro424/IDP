import { Hono } from 'hono';
import { serve } from 'std/server';

const app = new Hono();

app.get('/v1/bucket/:prefix', async (c) => {
  const prefix = c.req.param('prefix');
  // Dummy lookup: always return BLOCK for prefixes starting with '1'
  const verdict = prefix.startsWith('1') ? 'BLOCK' : 'ALLOW';
  return c.json({ verdict });
});

serve(app);
