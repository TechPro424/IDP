// Real benchmark script for Edge storage backends.
// It measures round‑trip latency for GET and POST on /v1/bucket/:prefix.
// Requires a running worker endpoint (e.g., via wrangler dev or Cloudflare dev server).

const N = 1000;
const prefixes = Array.from({ length: N }, (_, i) => `prefix-${i}`);
const baseUrl = process.env.BASE_URL || 'http://localhost:8787';

async function benchGet() {
  let total = 0;
  for (const p of prefixes) {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/v1/bucket/${encodeURIComponent(p)}`);
    await res.json();
    const elapsed = Date.now() - start;
    total += elapsed;
  }
  console.log(`GET: avg ${total / N} ms`);
}

async function benchPost() {
  let total = 0;
  for (const p of prefixes) {
    const start = Date.now();
    const res = await fetch(`${baseUrl}/v1/bucket/${encodeURIComponent(p)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: p }),
    });
    await res.json();
    const elapsed = Date.now() - start;
    total += elapsed;
  }
  console.log(`POST: avg ${total / N} ms`);
}

(async () => {
  console.log('Running GET benchmark...');
  await benchGet();
  console.log('Running POST benchmark...');
  await benchPost();
  console.log('Benchmark finished');
})();
