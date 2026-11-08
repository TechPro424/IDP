// Cloudflare Worker entry point (module syntax).
// The Hono app from handler.ts is the actual request handler.
import { createApp, type Env } from './handler.js';

const app = createApp();

export default {
  fetch: app.fetch,
};

export type { Env };
