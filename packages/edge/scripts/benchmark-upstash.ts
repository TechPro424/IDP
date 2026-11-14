// Placeholder benchmark for Upstash KV.
// Upstash KV uses HTTP API; replace URL and auth as needed.
const N = 100;
const baseUrl = process.env.UPSTASH_URL || 'https://example.upstash.io';
const token = process.env.UPSTASH_TOKEN || 'YOUR_TOKEN';

async function benchUpstashGet(): Promise<void> {
  let total = 0;
  for (let i = 0; i < N; i++) {
    const start = Date.now();
    await fetch(`${baseUrl}/kv/${i}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    total += Date.now() - start;
  }
  console.log(`Upstash GET avg ${total / N} ms`);
}

async function benchUpstashSet(): Promise<void> {
  let total = 0;
  for (let i = 0; i < N; i++) {
    const start = Date.now();
    await fetch(`${baseUrl}/kv/${i}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
      body: 'true',
    });
    total += Date.now() - start;
  }
  console.log(`Upstash SET avg ${total / N} ms`);
}

(async () => {
  await benchUpstashGet();
  await benchUpstashSet();
})();
